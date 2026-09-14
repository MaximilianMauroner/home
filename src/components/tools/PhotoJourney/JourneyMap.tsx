import { useEffect, useMemo, useRef, useState } from "react";
import type {
  GeoJSONSource,
  Map as MapLibreMap,
  Marker as MapLibreMarker,
  StyleSpecification,
} from "maplibre-gl";

import { trackSegments, type Track } from "./gpx";
import { journeyTravelZoom } from "./motion";
import {
  recordedLegCameraFrame,
  recordedLegPrefix,
  routePrefix,
  type RecordedLeg,
  type RouteStory,
} from "./route-progress";
import {
  cameraFor,
  inferredRouteSegments,
  locatedPoints,
  routeSegments,
  type JourneyStop,
  type JourneyPhase,
  type JourneyTimeline,
  type TimelineStop,
} from "./timeline";
import type { Placement } from "./track";
import type { Coordinates, JourneyPhoto } from "./types";

/** Street level for map tiles. The offline outline has no detail past regional scale. */
const STOP_ZOOM = 13;
const FOLLOW_ZOOM = 15;
const OFFLINE_STOP_ZOOM = 15;
const OFFLINE_FOLLOW_ZOOM = 17;
const OFFLINE_MAX_ZOOM = 18;

/** AWS Terrain Tiles, Terrarium-encoded PNG. Open data, no key, attribution required. */
export const TERRAIN_DEM_TILES = [
  "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png",
];
export const TERRAIN_EXAGGERATION = 1.4;
/** A steady north-up tilt gives local terrain depth without orbiting the route. */
export const TERRAIN_PITCH = 45;

export function journeyCameraPitch(
  mode: MapMode,
  globe: boolean,
  reducedMotion: boolean,
) {
  return mode === "terrain" && !globe && !reducedMotion ? TERRAIN_PITCH : 0;
}

/** Point the terrain camera along a broad route window instead of turning at every GPS sample. */
export function journeyCameraBearing(
  points: readonly Coordinates[],
  mode: MapMode,
  reducedMotion: boolean,
) {
  if (mode !== "terrain" || reducedMotion || points.length < 2) return 0;
  const from = points[0];
  const to = points.at(-1)!;
  const radians = Math.PI / 180;
  const deltaLongitude = (to.longitude - from.longitude) * radians;
  const fromLatitude = from.latitude * radians;
  const toLatitude = to.latitude * radians;
  const y = Math.sin(deltaLongitude) * Math.cos(toLatitude);
  const x =
    Math.cos(fromLatitude) * Math.sin(toLatitude) -
    Math.sin(fromLatitude) * Math.cos(toLatitude) * Math.cos(deltaLongitude);
  if (Math.abs(x) + Math.abs(y) < Number.EPSILON) return 0;
  return Math.atan2(y, x) / radians;
}

/** Interpolate across the shortest turn so seeking and playback produce the same heading. */
export function interpolateJourneyBearing(
  from: number,
  to: number,
  progress: number,
) {
  const delta = ((to - from + 540) % 360) - 180;
  const t = Math.max(0, Math.min(1, progress));
  return from + delta * t;
}

export function interpolateJourneyCamera(
  from: { center: [number, number]; zoom: number },
  to: { center: [number, number]; zoom: number },
  progress: number,
) {
  const t = Math.max(0, Math.min(1, progress));
  const longitudeDelta = ((to.center[0] - from.center[0] + 540) % 360) - 180;
  return {
    center: [
      from.center[0] + longitudeDelta * t,
      from.center[1] + (to.center[1] - from.center[1]) * t,
    ] as [number, number],
    zoom: from.zoom + (to.zoom - from.zoom) * t,
  };
}

export function checkpointMarkerPhotoIndex(
  checkpoint: Pick<TimelineStop, "photoIndex" | "photoIndices">,
  activeIndex: number,
  active: boolean,
) {
  return active && checkpoint.photoIndices.includes(activeIndex)
    ? activeIndex
    : checkpoint.photoIndex;
}

export function previousRecordedLeg(
  legs: readonly (RecordedLeg | undefined)[],
  activeIndex: number,
  activeLeg?: RecordedLeg,
) {
  if (!activeLeg) return undefined;
  const candidate = legs[activeIndex - 1];
  const previousEnd = candidate?.points.at(-1);
  const activeStart = activeLeg.points[0];
  return candidate?.segmentIndex === activeLeg.segmentIndex &&
    previousEnd &&
    activeStart &&
    previousEnd.latitude === activeStart.latitude &&
    previousEnd.longitude === activeStart.longitude
    ? candidate
    : undefined;
}

/** Keep an unmatched photo on its spatial GPX fallback or last verified recording point. */
export function routeTipForPlacement(placement?: Placement) {
  if (!placement || placement.ambiguous || placement.choiceUnavailable)
    return undefined;
  if (placement.source === "track") return placement.coordinates;
  return placement.trackCoordinates ?? placement.coordinates;
}
/** Legs longer than this arc on a globe instead of smearing across Mercator. */
export const GLOBE_LEG_KM = 1500;

export type MapMode = "offline" | "online" | "terrain";

type JourneyMapProps = {
  /** Route destination. This remains the checkpoint's first photo during a same-stop burst. */
  activeIndex: number;
  /** Exact photo visible in the album, including later photos at the same checkpoint. */
  activePhotoIndex?: number;
  photos: JourneyPhoto[];
  reducedMotion: boolean;
  stops: JourneyStop[];
  /** The recorded tour, when one was loaded. It replaces the photo-to-photo route. */
  track?: Track;
  /** Shared validated geometry used by both playback timing and map progress. */
  routeStory?: RouteStory;
  phase: JourneyPhase;
  /** A chapter boundary must reposition instead of animating an unrecorded overnight leg. */
  dayChange?: boolean;
  approachDuration: number;
  /** Remaining timeline time in the current phase; read only when a camera command starts. */
  phaseRemaining?: number;
  /** Timeline-derived progress for the active recorded leg. */
  currentLegProgress?: number;
  currentLegEligible?: boolean;
  dayChanges?: readonly boolean[];
  placements?: readonly Placement[];
  /** "offline" draws the bundled outline; "online" and "terrain" fetch OpenStreetMap tiles. */
  mapMode?: MapMode;
  playing: boolean;
  speed: number;
  seekVersion: number;
  /** The full stage size. The map element can still be growing out of its corner inset. */
  frame: { width: number; height: number };
  onMarkerPosition?: (point: { x: number; y: number } | null) => void;
  onTerrainState?: (state: { loading: boolean; failed: boolean }) => void;
  onEngineFailed?: () => void;
  onPlaybackReady?: (ready: boolean) => void;
  timeline: JourneyTimeline;
  cameraPadding: { top: number; right: number; bottom: number; left: number };
  checkpointProgress: number;
  followSuspended: boolean;
  onUserMove?: () => void;
  onCheckpointSelect?: (photoIndex: number, trigger: HTMLElement) => void;
};

/** MapLibre and the timeline both use milliseconds; playback speed scales that duration. */
export function approachAnimationDuration(
  approachDuration: number,
  speed: number,
) {
  return Math.max(0, approachDuration / Math.max(0.01, speed));
}

export function isUserMapMovement(event: unknown) {
  return Boolean(
    (event as { originalEvent?: unknown } | undefined)?.originalEvent,
  );
}

export type MarkerCollisionBox = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

/** Uses a small spatial grid so dense journeys do not compare every marker with every other marker. */
export function suppressedMarkerIndexes(
  boxes: readonly MarkerCollisionBox[],
  cellSize = 64,
) {
  const cells = new Map<string, number[]>();
  const suppressed = new Set<number>();
  const keysFor = (box: MarkerCollisionBox) => {
    const keys: string[] = [];
    const left = Math.floor(box.left / cellSize);
    const right = Math.floor(box.right / cellSize);
    const top = Math.floor(box.top / cellSize);
    const bottom = Math.floor(box.bottom / cellSize);
    for (let x = left; x <= right; x += 1) {
      for (let y = top; y <= bottom; y += 1) keys.push(`${x}:${y}`);
    }
    return keys;
  };
  boxes.forEach((box, index) => {
    const keys = keysFor(box);
    const candidates = new Set(keys.flatMap((key) => cells.get(key) ?? []));
    const overlaps = [...candidates].some((acceptedIndex) => {
      const accepted = boxes[acceptedIndex];
      return (
        box.left < accepted.right &&
        box.right > accepted.left &&
        box.top < accepted.bottom &&
        box.bottom > accepted.top
      );
    });
    if (overlaps) {
      suppressed.add(index);
      return;
    }
    keys.forEach((key) => cells.set(key, [...(cells.get(key) ?? []), index]));
  });
  return suppressed;
}

function lngLat({ latitude, longitude }: Coordinates): [number, number] {
  return [longitude, latitude];
}

/** Meridians and parallels every 15°, over three world copies for antimeridian legs. */
function graticule(): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (let lat = -75; lat <= 75; lat += 15)
    features.push({
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: [
          [-540, lat],
          [540, lat],
        ],
      },
    });
  for (let lon = -540; lon <= 540; lon += 15)
    features.push({
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: [
          [lon, -85],
          [lon, 85],
        ],
      },
    });
  return { type: "FeatureCollection", features };
}

const EMPTY_FEATURES: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

/** Exported for style-spec validation in tests. */
export function baseStyle(): StyleSpecification {
  return {
    version: 8,
    sources: {
      graticule: { type: "geojson", data: graticule() },
      land: { type: "geojson", data: EMPTY_FEATURES },
      osm: {
        type: "raster",
        tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
        tileSize: 256,
        maxzoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      },
      dem: {
        type: "raster-dem",
        tiles: TERRAIN_DEM_TILES,
        tileSize: 256,
        maxzoom: 15,
        encoding: "terrarium",
        attribution:
          'Terrain: <a href="https://registry.opendata.aws/terrain-tiles/">AWS Terrain Tiles</a> (3DEP, SRTM, GMTED)',
      },
      "route-completed": { type: "geojson", data: EMPTY_FEATURES },
      "route-context": { type: "geojson", data: EMPTY_FEATURES },
      "route-current": { type: "geojson", data: EMPTY_FEATURES },
      "route-inferred": { type: "geojson", data: EMPTY_FEATURES },
      "route-tip": { type: "geojson", data: EMPTY_FEATURES },
    },
    layers: [
      {
        id: "background",
        type: "background",
        paint: { "background-color": "#071014" },
      },
      {
        id: "graticule",
        type: "line",
        source: "graticule",
        paint: { "line-color": "#1a2c33", "line-width": 1 },
      },
      {
        id: "land-fill",
        type: "fill",
        source: "land",
        paint: { "fill-color": "#132328", "fill-opacity": 1 },
      },
      {
        id: "land-outline",
        type: "line",
        source: "land",
        paint: { "line-color": "#2a434b", "line-width": 1 },
      },
      {
        id: "osm",
        type: "raster",
        source: "osm",
        // Hidden until applyMode chooses a network mode: nothing may fetch before the choice.
        layout: { visibility: "none" },
        paint: {
          // A night pass over the standard tiles, close to the old inverted look.
          "raster-saturation": -0.4,
          "raster-brightness-max": 0.78,
          "raster-contrast": 0.12,
        },
      },
      {
        id: "hillshade",
        type: "hillshade",
        source: "dem",
        layout: { visibility: "none" },
        paint: {
          "hillshade-exaggeration": 0.35,
          "hillshade-shadow-color": "#05090b",
          "hillshade-highlight-color": "#3a4d52",
        },
      },
      {
        id: "route-context-halo",
        type: "line",
        source: "route-context",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "#071014",
          "line-opacity": 0.65,
          "line-width": 6,
        },
      },
      {
        id: "route-context",
        type: "line",
        source: "route-context",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "#67b9de",
          "line-opacity": 0.78,
          "line-width": 2.5,
        },
      },
      {
        id: "route-completed-halo",
        type: "line",
        source: "route-completed",
        layout: { "line-cap": "round" },
        paint: {
          "line-color": "#071014",
          "line-opacity": 0.7,
          "line-width": 7,
        },
      },
      {
        id: "route-completed",
        type: "line",
        source: "route-completed",
        layout: { "line-cap": "round" },
        paint: {
          "line-color": "#f2d487",
          "line-opacity": 0.82,
          "line-width": 2.5,
        },
      },
      {
        id: "route-current-halo",
        type: "line",
        source: "route-current",
        layout: { "line-cap": "round" },
        paint: {
          "line-color": "#071014",
          "line-opacity": 0.8,
          "line-width": 8,
        },
      },
      {
        id: "route-current",
        type: "line",
        source: "route-current",
        layout: { "line-cap": "round" },
        paint: {
          "line-color": "#fff0bd",
          "line-opacity": 1,
          "line-width": 3.5,
        },
      },
      {
        id: "route-inferred",
        type: "line",
        source: "route-inferred",
        layout: { "line-cap": "round" },
        paint: {
          "line-color": "#f2d487",
          "line-opacity": 0.7,
          "line-width": 2,
          "line-dasharray": [0.8, 2.8],
        },
      },
      {
        id: "route-tip",
        type: "circle",
        source: "route-tip",
        paint: {
          "circle-color": [
            "case",
            ["boolean", ["get", "carried"], false],
            "#f2d487",
            "#38bdf8",
          ],
          "circle-radius": 8,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 3,
        },
      },
    ],
  };
}

/** One land fetch per session. The outline is a separate chunk, so tiles mode never downloads it. */
let landPromise: Promise<number[][][]> | undefined;
function loadLand(): Promise<number[][][]> {
  if (!landPromise)
    landPromise = import("./land.json").then(
      ({ default: rings }) => rings as number[][][],
    );
  return landPromise;
}

/** The style never reloads: modes only flip layer visibility, so route and markers survive. */
function applyMode(map: MapLibreMap, mode: MapMode) {
  const flat = mode !== "terrain";
  const offline = mode === "offline";
  const show = (id: string, visible: boolean) =>
    map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
  show("graticule", offline);
  show("land-fill", offline);
  show("land-outline", offline);
  show("osm", !offline);
  show("hillshade", !flat);
  map.setMaxZoom(offline ? OFFLINE_MAX_ZOOM : 19);
  if (flat && map.getTerrain()) map.setTerrain(null);
}

function routeData(
  segments: readonly (readonly Coordinates[])[],
): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const segment of segments) {
    if (segment.length === 1) {
      features.push({
        type: "Feature",
        properties: { singleton: true },
        geometry: { type: "Point", coordinates: lngLat(segment[0]) },
      });
      continue;
    }
    for (const part of routeSegments([...segment])) {
      features.push({
        type: "Feature",
        properties: {},
        geometry: { type: "LineString", coordinates: part.map(lngLat) },
      });
    }
  }
  return { type: "FeatureCollection", features };
}

/** Pure presentation state, exported so gap and ambiguity behavior stays regression-testable. */
export function visibleRouteSegments(
  story: RouteStory,
  activeIndex: number,
  phase: JourneyPhase,
  currentProgress: number,
  currentEligible: boolean,
  currentPrefix?: Coordinates[],
  checkpointEndIndex = activeIndex,
) {
  const arrived =
    phase === "reveal" || phase === "hold" || phase === "departure";
  const completedIndex =
    phase === "outro" || phase === "complete"
      ? story.legs.length - 1
      : arrived
        ? checkpointEndIndex
        : activeIndex - 1;
  const completed: Coordinates[][] = [];
  for (let index = 0; index <= completedIndex; index += 1) {
    const leg = story.legs[index];
    if (leg) completed.push(leg.drawable);
  }
  const active = story.legs[activeIndex];
  if (phase === "approach" && active && currentEligible)
    return {
      completed,
      current: [currentPrefix ?? recordedLegPrefix(active, currentProgress)],
    };
  return { completed, current: [] as Coordinates[][] };
}

export default function JourneyMap({
  activeIndex,
  activePhotoIndex = activeIndex,
  photos,
  reducedMotion,
  stops,
  track,
  routeStory,
  phase,
  dayChange = false,
  approachDuration,
  phaseRemaining,
  currentLegProgress = 0,
  currentLegEligible = false,
  dayChanges,
  placements,
  mapMode = "offline",
  playing,
  speed,
  seekVersion,
  frame,
  onMarkerPosition,
  onTerrainState,
  onEngineFailed,
  onPlaybackReady,
  timeline,
  cameraPadding,
  checkpointProgress,
  followSuspended,
  onUserMove,
  onCheckpointSelect,
}: JourneyMapProps) {
  const mode = mapMode;
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap>();
  const moduleRef = useRef<typeof import("maplibre-gl")>();
  const markersRef = useRef(new Map<string, MapLibreMarker>());
  const mountedMarkerIdsRef = useRef(new Set<string>());
  const routePaintRef = useRef({ key: "", nextAt: 0 });
  const completedRef = useRef<{
    engine: number;
    segments: readonly (readonly Coordinates[])[];
  }>();
  const inferredCompletedRef = useRef<{
    engine: number;
    key: string;
    stops: JourneyStop[];
  }>();
  const projectionRef = useRef<"mercator" | "globe">("mercator");
  // Bumped once the engine arrives, so every effect below runs again against the live map.
  const [engine, setEngine] = useState(0);
  // Flipped once the style first loads. `isStyleLoaded` flaps while our own layer toggles
  // reload sources, so effects gate on this instead of asking per run.
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [terrainRevision, setTerrainRevision] = useState(0);
  // Read at command time only: a resize must not restart a camera move.
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const remainingRef = useRef(phaseRemaining ?? approachDuration);
  remainingRef.current = phaseRemaining ?? approachDuration;
  const cameraStateRef = useRef<{
    activeIndex: number;
    seekVersion: number;
    playing: boolean;
    phase: JourneyPhase;
    speed: number;
    mode: MapMode;
  }>();
  const dayChangesKey = useMemo(
    () => dayChanges?.map((change) => (change ? "1" : "0")).join(""),
    [dayChanges],
  );
  const activeRouteFrame = useMemo(() => {
    const leg = currentLegEligible ? routeStory?.legs[activeIndex] : undefined;
    return leg ? recordedLegCameraFrame(leg, currentLegProgress) : undefined;
  }, [activeIndex, currentLegEligible, currentLegProgress, routeStory]);
  const activeCheckpoint = useMemo(
    () =>
      timeline.stops.find((stop) => stop.photoIndices.includes(activeIndex)),
    [activeIndex, timeline],
  );
  const checkpointArrived =
    phase === "reveal" ||
    phase === "hold" ||
    phase === "departure" ||
    phase === "outro" ||
    phase === "complete";

  // The engine loads behind the same wait that already decodes the photos: a dynamic import
  // keeps the ~272 KB gz of WebGL mapping out of the first paint.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) return;
    // No WebGL, no map. The journey still plays as a slideshow behind the notice.
    if (!webglAvailable()) {
      setFailed(true);
      onEngineFailed?.();
      return;
    }
    let active = true;
    let map: MapLibreMap | undefined;
    let resize: ResizeObserver | undefined;
    let styleTimer: number | undefined;
    // The worker is bundled as its own chunk; its URL is handed to the engine, which would
    // otherwise resolve a relative path that the bundler never emits.
    void Promise.all([
      import("maplibre-gl"),
      import("maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url"),
    ]).then(
      ([module, { default: workerUrl }]) => {
        if (!active || !containerRef.current) return;
        moduleRef.current = module;
        module.config.WORKER_URL = workerUrl;
        const instance = new module.Map({
          container: containerRef.current,
          style: baseStyle(),
          center: [0, 0],
          zoom: 1,
          attributionControl: { compact: false },
          renderWorldCopies: true,
          maxPitch: TERRAIN_PITCH,
          // Full-resolution Retina terrain is expensive while the camera moves. This cap keeps
          // labels crisp without asking the GPU to redraw a 4K backing canvas every frame.
          pixelRatio: Math.min(window.devicePixelRatio, 1.5),
        });
        map = instance;
        instance.addControl(
          new module.NavigationControl({
            showCompass: false,
            visualizePitch: false,
          }),
          "top-right",
        );
        instance.getCanvas().addEventListener("webglcontextlost", (event) => {
          // A lost context never recovers its tiles; say so instead of showing a dead map.
          event.preventDefault();
          setFailed(true);
          onEngineFailed?.();
        });
        mapRef.current = instance;
        const box = containerRef.current;
        resize = new ResizeObserver(() => instance.resize());
        resize.observe(box);
        // Playback needs the sources and layers installed, not every remote tile. Check the
        // concrete resources as well as the event because an inline style may settle before a
        // listener observes its final event.
        let styleSettled = false;
        const finishStyle = () => {
          if (!active || styleSettled) return;
          if (
            !instance.getSource("route-current") ||
            !instance.getLayer("route-current")
          )
            return;
          styleSettled = true;
          instance.off("styledata", finishStyle);
          if (styleTimer !== undefined) window.clearTimeout(styleTimer);
          setFailed(false);
          setReady(true);
          setEngine((version) => version + 1);
        };
        instance.on("styledata", finishStyle);
        finishStyle();
        styleTimer = window.setTimeout(() => {
          if (!active || styleSettled) return;
          instance.off("styledata", finishStyle);
          setFailed(true);
        }, 5_000);
        setEngine((version) => version + 1);
      },
      () => {
        if (!active) return;
        setFailed(true);
        onEngineFailed?.();
      },
    );
    return () => {
      active = false;
      if (styleTimer !== undefined) window.clearTimeout(styleTimer);
      resize?.disconnect();
      map?.remove();
      mapRef.current = undefined;
      moduleRef.current = undefined;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    onPlaybackReady?.(ready || failed);
    return () => onPlaybackReady?.(false);
  }, [failed, onPlaybackReady, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    applyMode(map, mode);
    if (mode !== "offline") return;
    let active = true;
    // Three world copies keep land visible when a leg crosses the antimeridian.
    void loadLand().then((rings) => {
      if (!active || !mapRef.current) return;
      // One polygon per ring: every ring is its own island, not a hole in the first one.
      // Three world copies keep land visible when a leg crosses the antimeridian.
      const shifted = [-360, 0, 360].flatMap((shift) =>
        rings.map((ring) => [ring.map(([lon, lat]) => [lon + shift, lat])]),
      );
      (map.getSource("land") as GeoJSONSource | undefined)?.setData({
        type: "MultiPolygon",
        coordinates: shifted,
      });
    });
    return () => {
      active = false;
    };
  }, [mode, ready, engine]);

  // Terrain is a tile download, so its state is reported for the mode notice.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (mode !== "terrain") {
      onTerrainState?.({ loading: false, failed: false });
      return;
    }
    map.setTerrain({ source: "dem", exaggeration: TERRAIN_EXAGGERATION });
    if (map.isSourceLoaded("dem")) {
      onTerrainState?.({ loading: false, failed: false });
      return;
    }
    let done = false;
    onTerrainState?.({ loading: true, failed: false });
    const finish = (failed: boolean) => {
      if (done) return;
      done = true;
      onTerrainState?.({ loading: false, failed });
    };
    const onSource = (event: unknown) => {
      const sourceId = (event as { sourceId?: string } | null)?.sourceId;
      if (sourceId === "dem" && map.isSourceLoaded("dem")) finish(false);
    };
    const onError = (event: unknown) => {
      if ((event as { sourceId?: string } | null)?.sourceId === "dem")
        finish(true);
    };
    const timer = window.setTimeout(
      () => finish(!map.isSourceLoaded("dem")),
      12000,
    );
    map.on("sourcedata", onSource);
    map.on("error", onError);
    return () => {
      window.clearTimeout(timer);
      map.off("sourcedata", onSource);
      map.off("error", onError);
    };
  }, [mode, ready, onTerrainState, engine]);

  // New elevation tiles can correct the camera altitude after a paused jump. Refresh
  // composition and DOM markers after those tiles render, even when playback is idle.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || mode !== "terrain") return;
    let pending = false;
    const refresh = () => {
      pending = false;
      if (playing) return;
      for (const marker of markersRef.current.values())
        marker.setLngLat(marker.getLngLat());
      // Let an in-progress overview animation finish; tile arrivals must not restart it.
      if (!map.isMoving()) setTerrainRevision((revision) => revision + 1);
    };
    const onSource = (event: { sourceId?: string; tile?: unknown }) => {
      if (event.sourceId !== "dem" || !event.tile || pending) return;
      pending = true;
      map.once("render", refresh);
    };
    map.on("sourcedata", onSource);
    return () => {
      map.off("sourcedata", onSource);
      map.off("render", refresh);
    };
  }, [mode, ready, engine, playing]);

  // Static markers change with source data, never with the playback frame. The recording itself
  // is deliberately absent here: route geometry is revealed only by the playback overlays below.
  useEffect(() => {
    const map = mapRef.current;
    const module = moduleRef.current;
    if (!map || !module || !ready) return;
    // A dashed photo-to-photo connection is explicitly inferred and only exists without a
    // recording. A recording with sparse or singleton data must not be replaced by an invented line.
    (map.getSource("route-inferred") as GeoJSONSource | undefined)?.setData(
      EMPTY_FEATURES,
    );
    for (const marker of markersRef.current.values()) marker.remove();
    mountedMarkerIdsRef.current.clear();
    const markers = new Map<string, MapLibreMarker>();
    timeline.stops.forEach((checkpoint) => {
      const index = checkpoint.photoIndex;
      const photo = photos[index];
      const stop = stops[index];
      const coordinates = stop?.located ? stop.coordinates : undefined;
      if (!coordinates || !photo) return;
      // The marker element mirrors the old Leaflet structure, so the pin styling is untouched.
      const wrapper = document.createElement("button");
      wrapper.type = "button";
      wrapper.className = "pj-map-marker";
      const pin = document.createElement("div");
      pin.className = "pj-pin";
      const img = document.createElement("img");
      img.src = photo.thumbnailUrl;
      img.alt = "";
      pin.append(img);
      wrapper.append(pin);
      wrapper.title = photo.name;
      wrapper.setAttribute(
        "aria-label",
        `Open ${checkpoint.photoIndices.length === 1 ? photo.name : `${checkpoint.photoIndices.length} photos`} at checkpoint`,
      );
      wrapper.dataset.count =
        checkpoint.photoIndices.length > 1
          ? String(checkpoint.photoIndices.length)
          : "";
      wrapper.addEventListener("click", () =>
        onCheckpointSelect?.(index, wrapper),
      );
      const marker = new module.Marker({
        element: wrapper,
        anchor: "center",
        pitchAlignment: "viewport",
        rotationAlignment: "viewport",
        opacityWhenCovered: 0.65,
      })
        .setLngLat(lngLat(coordinates))
        .addTo(map);
      markers.set(photo.id, marker);
      mountedMarkerIdsRef.current.add(photo.id);
    });
    markersRef.current = markers;
    // dayChanges is commonly mapped from stable timeline stops at the JSX boundary.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    photos,
    stops,
    track,
    routeStory,
    timeline,
    dayChangesKey,
    ready,
    engine,
    onCheckpointSelect,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    (map.getSource("route-context") as GeoJSONSource | undefined)?.setData(
      routeStory ? routeData(routeStory.context) : EMPTY_FEATURES,
    );
  }, [routeStory, ready, engine]);

  // Only the small narrative overlays change with playback. The full recording stays in the
  // static context source, avoiding repeated work on recording-sized arrays.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    // GeoJSON updates cross a worker boundary and force the terrain scene to repaint. Keep the
    // camera on the display clock, but cap route serialization at a visually continuous 30 Hz.
    const now = performance.now();
    const paintKey = `${engine}:${seekVersion}:${activeIndex}:${phase}`;
    if (routePaintRef.current.key !== paintKey)
      routePaintRef.current = { key: paintKey, nextAt: 0 };
    if (playing && phase === "approach") {
      const interval = 1000 / 30;
      const deadline = routePaintRef.current.nextAt;
      if (deadline && now < deadline) return;
      routePaintRef.current.nextAt = deadline
        ? deadline + interval * (Math.floor((now - deadline) / interval) + 1)
        : now + interval;
    } else {
      routePaintRef.current.nextAt = 0;
    }
    const showPosition = (position?: Coordinates, carried = false) => {
      (map.getSource("route-tip") as GeoJSONSource | undefined)?.setData(
        position
          ? {
              type: "FeatureCollection",
              features: [
                {
                  type: "Feature",
                  properties: { carried },
                  geometry: { type: "Point", coordinates: lngLat(position) },
                },
              ],
            }
          : EMPTY_FEATURES,
      );
    };
    const arrived =
      phase === "reveal" || phase === "hold" || phase === "departure";
    const checkpointEndIndex =
      activeCheckpoint?.photoIndices.at(-1) ?? activeIndex;
    if (!routeStory) {
      if (
        completedRef.current?.engine !== engine ||
        completedRef.current.segments.length
      ) {
        completedRef.current = { engine, segments: [] };
        (
          map.getSource("route-completed") as GeoJSONSource | undefined
        )?.setData(EMPTY_FEATURES);
      }
      const completedThrough =
        phase === "outro" || phase === "complete"
          ? stops.length
          : activeIndex +
            (phase === "reveal" || phase === "hold" || phase === "departure"
              ? 1
              : 0);
      const completedKey = `${completedThrough}:${dayChangesKey}`;
      const previousInferred = inferredCompletedRef.current;
      if (
        previousInferred?.engine !== engine ||
        previousInferred?.key !== completedKey ||
        previousInferred?.stops !== stops
      ) {
        const completed = inferredRouteSegments(
          stops.slice(0, completedThrough),
          dayChanges?.slice(0, completedThrough),
        );
        inferredCompletedRef.current = { engine, key: completedKey, stops };
        (map.getSource("route-inferred") as GeoJSONSource | undefined)?.setData(
          routeData(completed),
        );
      }
      const previous = stops[activeIndex - 1];
      const current = stops[activeIndex];
      const traveling =
        !track &&
        phase === "approach" &&
        currentLegEligible &&
        previous?.located &&
        current?.located &&
        previous.coordinates &&
        current.coordinates
          ? [
              routePrefix(
                [previous.coordinates, current.coordinates],
                currentLegProgress,
              ),
            ]
          : [];
      (map.getSource("route-current") as GeoJSONSource | undefined)?.setData(
        routeData(traveling),
      );
      const settled = stops[checkpointEndIndex];
      showPosition(
        traveling[0]?.at(-1) ??
          (arrived && settled?.located ? settled.coordinates : undefined),
      );
      return;
    }
    const activeLeg = currentLegEligible
      ? routeStory.legs[activeIndex]
      : undefined;
    const visible = visibleRouteSegments(
      routeStory,
      activeIndex,
      phase,
      currentLegProgress,
      currentLegEligible,
      activeLeg ? recordedLegPrefix(activeLeg, currentLegProgress) : undefined,
      activeCheckpoint?.photoIndices.at(-1),
    );
    // Completed legs are whole recorded slices that only change at a stop boundary, while this
    // effect runs on every playback frame. Re-serializing them per frame would ship the entire
    // travelled route to the GeoJSON worker 60 times a second.
    const previous = completedRef.current;
    const unchanged =
      previous?.engine === engine &&
      previous.segments.length === visible.completed.length &&
      previous.segments.every(
        (segment, index) => segment === visible.completed[index],
      );
    if (!unchanged) {
      completedRef.current = { engine, segments: visible.completed };
      (map.getSource("route-completed") as GeoJSONSource | undefined)?.setData(
        routeData(visible.completed),
      );
    }
    (map.getSource("route-current") as GeoJSONSource | undefined)?.setData(
      routeData(visible.current),
    );
    const placement = placements?.[checkpointEndIndex];
    const settled = routeTipForPlacement(placement);
    const carried = placement?.source === "carried";
    const tip =
      phase === "approach" && currentLegEligible
        ? activeRouteFrame?.tip
        : arrived
          ? settled
          : undefined;
    showPosition(tip, Boolean(arrived && settled && carried));
  }, [
    routeStory,
    activeRouteFrame,
    activeIndex,
    activeCheckpoint,
    phase,
    currentLegProgress,
    currentLegEligible,
    placements,
    stops,
    track,
    timeline,
    dayChanges,
    dayChangesKey,
    playing,
    seekVersion,
    ready,
    engine,
  ]);

  // Checkpoints begin as quiet dots, reveal their photo on arrival, and remain as visited stops.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const markers = markersRef.current;
    const mounted = mountedMarkerIdsRef.current;
    const activeCheckpointIndex = activeCheckpoint?.checkpointIndex;
    timeline.stops.forEach((checkpoint) => {
      const index = checkpoint.photoIndex;
      const photo = photos[index];
      const marker = photo ? markers.get(photo.id) : undefined;
      const element = marker?.getElement();
      if (!element) return;
      const active =
        checkpoint.checkpointIndex === activeCheckpointIndex &&
        checkpointArrived;
      if (active) {
        const activePhoto =
          photos[
            checkpointMarkerPhotoIndex(checkpoint, activePhotoIndex, active)
          ];
        const image = element.querySelector("img");
        if (activePhoto && image) {
          image.src = activePhoto.thumbnailUrl;
          element.title = activePhoto.name;
          element.setAttribute(
            "aria-label",
            `Current photo: ${activePhoto.name}`,
          );
        }
      }
      element.classList.toggle("pj-map-marker-active", active);
      element.classList.toggle("pj-map-marker-selected", active && !playing);
      element.classList.toggle(
        "pj-map-marker-past",
        index < activeIndex || active,
      );
      element.classList.toggle(
        "pj-map-marker-future",
        index > activeIndex || (index === activeIndex && !checkpointArrived),
      );
      element.classList.toggle(
        "pj-map-marker-playback-hidden",
        playing && !active,
      );
      element.style.setProperty("--pj-checkpoint-progress", active ? "1" : "0");
      element.style.zIndex = active ? "3" : index < activeIndex ? "2" : "1";
      const shouldMount = !playing || active;
      if (shouldMount && marker && photo && !mounted.has(photo.id)) {
        marker.addTo(map);
        mounted.add(photo.id);
      } else if (!shouldMount && marker && photo && mounted.has(photo.id)) {
        marker.remove();
        mounted.delete(photo.id);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeIndex,
    activePhotoIndex,
    activeCheckpoint,
    checkpointArrived,
    photos,
    stops,
    track,
    routeStory,
    timeline,
    playing,
    dayChangesKey,
    ready,
    engine,
  ]);

  // Reveal and departure animate only the active marker. Hundreds of inactive markers remain
  // untouched while the timeline advances frame by frame.
  useEffect(() => {
    const photo = activeCheckpoint
      ? photos[activeCheckpoint.photoIndex]
      : undefined;
    const element = photo
      ? markersRef.current.get(photo.id)?.getElement()
      : undefined;
    if (!element) return;
    const progress =
      phase === "reveal" || phase === "departure" ? checkpointProgress : 1;
    element.style.setProperty("--pj-checkpoint-progress", String(progress));
    element.dataset.departing = String(phase === "departure");
  }, [activeCheckpoint, checkpointProgress, phase, photos]);

  // Marker collisions are presentation-only: underlying checkpoint visits and photo order stay
  // intact. The active checkpoint wins, then visited markers, then upcoming camera badges.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (playing) {
      // Playback mounts at most its active photo marker. Clear stale browse suppression without
      // forcing layout reads for every checkpoint on each camera frame.
      for (const marker of markersRef.current.values()) {
        const element = marker.getElement();
        const active = element.classList.contains("pj-map-marker-active");
        element.classList.remove("pj-map-marker-suppressed");
        element.tabIndex = active ? 0 : -1;
        if (active) element.removeAttribute("aria-hidden");
        else element.setAttribute("aria-hidden", "true");
      }
      return;
    }
    const update = () => {
      const elements = [...markersRef.current.values()].map((marker) =>
        marker.getElement(),
      );
      elements.sort(
        (a, b) =>
          Number(b.classList.contains("pj-map-marker-active")) -
            Number(a.classList.contains("pj-map-marker-active")) ||
          Number(b.classList.contains("pj-map-marker-past")) -
            Number(a.classList.contains("pj-map-marker-past")),
      );
      const spacing = map.getZoom() < 11 ? 34 : 12;
      const boxes = elements.map((element) => {
        const box = element.getBoundingClientRect();
        return {
          left: box.left - spacing,
          right: box.right + spacing,
          top: box.top - spacing,
          bottom: box.bottom + spacing,
        };
      });
      const suppressed = suppressedMarkerIndexes(boxes);
      elements.forEach((element, index) => {
        const hidden =
          suppressed.has(index) &&
          !element.classList.contains("pj-map-marker-active");
        element.classList.toggle("pj-map-marker-suppressed", hidden);
        element.tabIndex = hidden ? -1 : 0;
        if (hidden) element.setAttribute("aria-hidden", "true");
        else element.removeAttribute("aria-hidden");
      });
    };
    // Refresh after programmatic camera moves too. Cap layout reads during playback.
    let timer: number | undefined;
    const schedule = () => {
      if (timer !== undefined) return;
      timer = window.setTimeout(() => {
        timer = undefined;
        update();
      }, 160);
    };
    schedule();
    map.on("move", schedule);
    map.on("moveend", schedule);
    map.on("resize", schedule);
    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
      map.off("move", schedule);
      map.off("moveend", schedule);
      map.off("resize", schedule);
    };
  }, [
    activeIndex,
    checkpointArrived,
    timeline,
    engine,
    terrainRevision,
    playing,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const userMove = (event: unknown) => {
      if (isUserMapMovement(event)) onUserMove?.();
    };
    map.on("dragstart", userMove);
    map.on("zoomstart", userMove);
    return () => {
      map.off("dragstart", userMove);
      map.off("zoomstart", userMove);
    };
  }, [onUserMove, engine]);

  useEffect(() => {
    const map = mapRef.current;
    // `emit` forces a layout read on every rendered frame, so it stays unsubscribed until a
    // caller actually wants marker positions.
    if (!map || !onMarkerPosition) return;
    const emit = () => {
      const position = stops[activeIndex]?.coordinates;
      const element = containerRef.current;
      if (!position || !element) {
        onMarkerPosition?.(null);
        return;
      }
      const point = map.project(lngLat(position));
      // Reported in page coordinates. The map element is a corner inset during a photo and grows
      // back to the full stage for the next leg, so a point in its own space means nothing to the
      // stage until it is mapped onto the element's live box.
      const box = element.getBoundingClientRect();
      const view = map.getContainer().clientWidth || 1;
      const height = map.getContainer().clientHeight || 1;
      onMarkerPosition?.({
        x: box.left + (point.x / Math.max(1, view)) * box.width,
        y: box.top + (point.y / Math.max(1, height)) * box.height,
      });
    };
    emit();
    map.on("move", emit);
    map.on("resize", emit);
    return () => {
      map.off("move", emit);
      map.off("resize", emit);
    };
  }, [activeIndex, stops, onMarkerPosition, engine]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (followSuspended) return;
    const previousState = cameraStateRef.current;
    const commandChanged =
      !previousState ||
      previousState.activeIndex !== activeIndex ||
      previousState.seekVersion !== seekVersion ||
      previousState.playing !== playing ||
      previousState.phase !== phase ||
      previousState.speed !== speed ||
      previousState.mode !== mode;
    cameraStateRef.current = {
      activeIndex,
      seekVersion,
      playing,
      phase,
      speed,
      mode,
    };
    if (commandChanged) map.stop();
    if (
      !playing &&
      previousState?.playing &&
      previousState.activeIndex === activeIndex &&
      previousState.seekVersion === seekVersion &&
      previousState.phase === phase
    )
      return;
    const stopZoom = mode === "offline" ? OFFLINE_STOP_ZOOM : STOP_ZOOM;
    const overview =
      phase === "intro" ||
      phase === "outro" ||
      phase === "complete" ||
      phase === "overview";
    const move = cameraFor(stops, activeIndex);
    // Simplifying a recording-sized track is only worth it for the framing branch below, which
    // runs four times per stop. A leg needs its own two endpoints instead.
    const overviewPoints = () =>
      track ? trackSegments(track, 60).flat() : locatedPoints(stops);
    // A long hop arcs on a globe instead of smearing across Mercator.
    const projectionPoints = overview
      ? overviewPoints()
      : [move?.from, move?.center].flatMap((point) => (point ? [point] : []));
    const globe = mode !== "offline" && legSpansGlobe(projectionPoints);
    const pitch = journeyCameraPitch(mode, globe, reducedMotion);
    const fit = (points: Coordinates[], maxZoom: number) =>
      cameraFrameForPoints(
        unwrapPoints(points),
        frameRef.current,
        70,
        maxZoom,
        cameraPadding,
        pitch,
        map.getVerticalFieldOfView(),
      );
    if (projectionRef.current !== (globe ? "globe" : "mercator")) {
      projectionRef.current = globe ? "globe" : "mercator";
      try {
        map.setProjection({ type: projectionRef.current });
      } catch {
        // Older engine mid-upgrade; the journey plays flat instead of breaking.
      }
    }
    if (overview) {
      // The opening and closing views frame the whole tour, which is wider than the photo stops.
      if (!projectionPoints.length) return;
      const maxOverviewZoom = mode === "offline" ? OFFLINE_MAX_ZOOM : stopZoom;
      const view = fit(projectionPoints, maxOverviewZoom);
      if (!playing || reducedMotion)
        map.jumpTo({
          center: view.center,
          zoom: view.zoom,
          bearing: 0,
          pitch,
          padding: cameraPadding,
        });
      else
        map.easeTo({
          center: view.center,
          zoom: view.zoom,
          bearing: 0,
          pitch,
          padding: cameraPadding,
          duration: approachAnimationDuration(remainingRef.current, speed),
        });
      return;
    }
    if (!move) {
      const fallbackPoints = overviewPoints();
      if (!fallbackPoints.length) return;
      const view = fit(
        fallbackPoints,
        mode === "offline" ? OFFLINE_MAX_ZOOM : stopZoom,
      );
      map.jumpTo({
        center: view.center,
        zoom: view.zoom,
        bearing: 0,
        pitch,
        padding: cameraPadding,
      });
      return;
    }
    // Reposition while the opaque day card covers the map. The first uncovered frame is already
    // at the next day's real first fix, so there is no invented overnight flight or visible snap.
    if (phase === "day") {
      const entryLeg = currentLegEligible
        ? routeStory?.legs[activeIndex]
        : undefined;
      const entryFrame = entryLeg
        ? recordedLegCameraFrame(entryLeg, 0)
        : undefined;
      const entryView = entryFrame?.window.length
        ? fit(
            entryFrame.window,
            mode === "offline" ? OFFLINE_FOLLOW_ZOOM : FOLLOW_ZOOM,
          )
        : undefined;
      map.jumpTo({
        center: entryView?.center ?? lngLat(move.center),
        zoom: entryView?.zoom ?? stopZoom,
        bearing: entryLeg
          ? journeyCameraBearing(entryLeg.drawable, mode, reducedMotion)
          : 0,
        pitch,
        padding: cameraPadding,
      });
      return;
    }
    // Missing fixes inherit the last camera position. Seeking still restores that position.
    if (
      !stops[activeIndex]?.located &&
      playing &&
      previousState?.seekVersion === seekVersion
    )
      return;
    const center = {
      ...move.center,
      longitude: nearestLongitude(move.center.longitude, map.getCenter().lng),
    };
    if (dayChange && phase === "approach" && !activeRouteFrame) {
      map.jumpTo({
        center: lngLat(center),
        zoom: stopZoom,
        bearing: 0,
        pitch,
        padding: cameraPadding,
      });
      return;
    }
    const recordedLegKnown = !track || Boolean(activeRouteFrame);
    const padding = cameraPadding;
    const routeWindow = activeRouteFrame?.window ?? [];
    const activeRecordedLeg = routeStory?.legs[activeIndex];
    const activeLegPoints =
      activeRecordedLeg?.drawable ??
      (move.from ? [move.from, move.center] : routeWindow);
    const targetBearing = journeyCameraBearing(
      activeLegPoints,
      mode,
      reducedMotion,
    );
    const previousLeg = routeStory
      ? previousRecordedLeg(routeStory.legs, activeIndex, activeRecordedLeg)
      : undefined;
    const previousBearing = previousLeg
      ? journeyCameraBearing(previousLeg.drawable, mode, reducedMotion)
      : targetBearing;
    const cameraBlendFraction = Math.min(
      1,
      700 / Math.max(1, approachDuration ?? 700),
    );
    const routeBearing =
      phase === "approach" && activeRecordedLeg && previousLeg && !dayChange
        ? interpolateJourneyBearing(
            previousBearing,
            targetBearing,
            currentLegProgress / cameraBlendFraction,
          )
        : targetBearing;
    const followZoom = mode === "offline" ? OFFLINE_FOLLOW_ZOOM : FOLLOW_ZOOM;
    if (phase !== "approach") {
      const settled = routeWindow.length
        ? fit([...routeWindow, center], followZoom)
        : { center: lngLat(center), zoom: stopZoom };
      map.jumpTo({
        center: settled.center,
        zoom: settled.zoom,
        bearing: routeBearing,
        pitch,
        padding,
      });
      return;
    }
    if (
      reducedMotion ||
      (!move.from && !activeRouteFrame) ||
      !recordedLegKnown
    ) {
      map.jumpTo({
        center: lngLat(center),
        zoom: stopZoom,
        bearing: 0,
        pitch,
        padding,
      });
      return;
    }
    // Garmin/Strava style: ride the recorded line instead of flying straight at the photo.
    // The follow effect below re-centers on every progress frame; here only set the zoom
    // and an initial position so there is no straight-line flight to fight it.
    const inferredStart = move.from;
    const inferredTip =
      !track && inferredStart
        ? routePrefix([inferredStart, move.center], currentLegProgress).at(-1)
        : undefined;
    if (activeRouteFrame || inferredTip) {
      const tip = inferredTip ?? activeRouteFrame?.tip;
      if (!tip) return;
      let view = routeWindow.length ? fit(routeWindow, followZoom) : undefined;
      if (view && previousLeg && !dayChange) {
        const previousWindow = recordedLegCameraFrame(previousLeg, 1).window;
        const previousView = fit(previousWindow, followZoom);
        view = interpolateJourneyCamera(
          previousView,
          view,
          currentLegProgress / cameraBlendFraction,
        );
      }
      const legZoom =
        inferredTip && inferredStart
          ? fit([inferredStart, move.center], stopZoom).zoom
          : stopZoom;
      map.jumpTo({
        center:
          view?.center ??
          lngLat({
            latitude: tip.latitude,
            longitude: nearestLongitude(tip.longitude, map.getCenter().lng),
          }),
        zoom:
          view?.zoom ??
          journeyTravelZoom(currentLegProgress, stopZoom, legZoom),
        bearing: routeBearing,
        pitch,
        padding,
      });
      return;
    }
    if (!inferredStart) return;
    const leg = fit([inferredStart, move.center], stopZoom);
    if (!playing) {
      map.jumpTo({
        center: lngLat(center),
        zoom: leg.zoom,
        bearing: 0,
        pitch,
        padding,
      });
      return;
    }
    const continuing =
      previousState?.activeIndex === activeIndex &&
      previousState.seekVersion === seekVersion &&
      previousState.phase === "approach";
    // Pull back once when a leg starts. Pause/resume and speed changes continue from the live
    // camera with only the remaining timeline duration; they never restart the whole leg.
    if (!continuing)
      map.jumpTo({
        center: map.getCenter(),
        zoom: leg.zoom,
        bearing: 0,
        pitch,
      });
    map.flyTo({
      center: lngLat(center),
      zoom: stopZoom,
      bearing: 0,
      pitch,
      duration: approachAnimationDuration(remainingRef.current, speed),
    });
  }, [
    activeIndex,
    phase,
    dayChange,
    reducedMotion,
    stops,
    track,
    routeStory,
    activeRouteFrame,
    playing,
    speed,
    seekVersion,
    approachDuration,
    currentLegEligible,
    currentLegProgress,
    cameraPadding,
    followSuspended,
    mode,
    terrainRevision,
    ready,
    engine,
  ]);

  return (
    <div
      ref={containerRef}
      className="pj-gl-map"
      data-offline={mode === "offline"}
    >
      {failed && (
        <div className="pj-map-empty">
          <strong>3D map unavailable</strong>
          <span>
            The journey plays on without it. WebGL is off or unsupported here.
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Fits north-up Mercator bounds inside the uncovered stage. Perspective enlarges the
 * near edge of tilted bounds, so reserve space for that edge as well as the flat footprint.
 * The pixel margin also leaves breathing room for markers and terrain relief.
 */
export function cameraFrameForPoints(
  points: Coordinates[],
  frame: { width: number; height: number },
  padding: number,
  maxZoom: number,
  edgePadding: { top: number; right: number; bottom: number; left: number } = {
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  pitch = 0,
  verticalFieldOfView = 36.86989764584402,
) {
  if (!points.length) return { center: [0, 0] as [number, number], zoom: 0 };
  const projected = points.map((point) => {
    const latitude = Math.max(-85.051129, Math.min(85.051129, point.latitude));
    const radians = (latitude * Math.PI) / 180;
    return {
      x: (point.longitude + 180) / 360,
      y:
        (1 - Math.log(Math.tan(radians) + 1 / Math.cos(radians)) / Math.PI) / 2,
    };
  });
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const point of projected) {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
  }
  const width = Math.max(
    1,
    frame.width - padding * 2 - edgePadding.left - edgePadding.right,
  );
  const height = Math.max(
    1,
    frame.height - padding * 2 - edgePadding.top - edgePadding.bottom,
  );
  let scale = Math.min(
    width / Math.max(1 / 512, (maxX - minX) * 512),
    height / Math.max(1 / 512, (maxY - minY) * 512),
  );
  if (pitch > 0) {
    const radians = (Math.min(TERRAIN_PITCH, pitch) * Math.PI) / 180;
    const distance =
      Math.max(1, frame.height) /
      (2 * Math.tan((verticalFieldOfView * Math.PI) / 360));
    const halfX = (maxX - minX) * 256;
    const halfY = (maxY - minY) * 256;
    // At scale s, the near edge is halfY*s*sin(pitch) closer to the camera.
    // Solve the perspective screen bounds for s without moving the live map to probe it.
    const depth = halfY * Math.sin(radians);
    const widthLimit =
      ((width / 2) * distance) / (halfX * distance + (width / 2) * depth);
    const heightLimit =
      ((height / 2) * distance) /
      (halfY * Math.cos(radians) * distance + (height / 2) * depth);
    scale = Math.min(scale, widthLimit, heightLimit);
  }
  const fitted = Math.max(0, Math.min(maxZoom, Math.log2(scale)));
  const x = (minX + maxX) / 2;
  const y = (minY + maxY) / 2;
  const longitude = x * 360 - 180;
  const latitude =
    (Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180) / Math.PI;
  return { center: [longitude, latitude] as [number, number], zoom: fitted };
}
function nearestLongitude(longitude: number, reference: number) {
  return longitude + Math.round((reference - longitude) / 360) * 360;
}
function unwrapPoints(points: Coordinates[]) {
  let longitude = points[0]?.longitude ?? 0;
  return points.map((point) => {
    longitude = nearestLongitude(point.longitude, longitude);
    return { ...point, longitude };
  });
}

/** True when a leg is long enough to arc on a globe instead of smearing on Mercator. */
export function legSpansGlobe(points: Coordinates[]) {
  let farthest = 0;
  for (let index = 1; index < points.length; index += 1) {
    const step = points[index];
    const previous = points[index - 1];
    if (!step || !previous) continue;
    const gap = Math.abs(step.longitude - previous.longitude);
    farthest = Math.max(farthest, gap > 180 ? 360 - gap : gap);
  }
  return farthest * 111.32 > GLOBE_LEG_KM;
}

function webglAvailable() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}
