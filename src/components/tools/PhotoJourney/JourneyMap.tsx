import { useEffect, useMemo, useRef, useState } from "react";
import type {
  GeoJSONSource,
  Map as MapLibreMap,
  Marker as MapLibreMarker,
  StyleSpecification,
} from "maplibre-gl";

import { trackSegments, type Track } from "./gpx";
import {
  buildRouteStory,
  recordedLegPrefix,
  type RouteStory,
} from "./route-progress";
import {
  cameraFor,
  inferredRouteSegments,
  locatedPoints,
  routeSegments,
  type JourneyStop,
  type JourneyPhase,
} from "./timeline";
import type { Placement } from "./track";
import type { Coordinates, JourneyPhoto } from "./types";

/** Street level for map tiles. The offline outline has no detail past regional scale. */
const STOP_ZOOM = 13;
const OFFLINE_STOP_ZOOM = 8;
const OFFLINE_MAX_ZOOM = 8;

/** AWS Terrain Tiles, Terrarium-encoded PNG. Open data, no key, attribution required. */
export const TERRAIN_DEM_TILES = [
  "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png",
];
export const TERRAIN_EXAGGERATION = 1.4;
/** The arrival tilt. Fixed: higher pitches over exaggerated terrain cause motion sickness. */
export const TERRAIN_PITCH = 62;
/** Legs longer than this arc on a globe instead of smearing across Mercator. */
export const GLOBE_LEG_KM = 1500;

export type MapMode = "offline" | "online" | "terrain";

type JourneyMapProps = {
  activeIndex: number;
  photos: JourneyPhoto[];
  reducedMotion: boolean;
  stops: JourneyStop[];
  /** The recorded tour, when one was loaded. It replaces the photo-to-photo route. */
  track?: Track;
  phase: JourneyPhase;
  /** A chapter boundary must reposition instead of animating an unrecorded overnight leg. */
  dayChange?: boolean;
  approachDuration: number;
  /** Remaining timeline time in the current phase; read only when a camera command starts. */
  phaseRemaining?: number;
  /** Timeline-derived progress for the active recorded leg. */
  currentLegProgress?: number;
  currentLegEligible?: boolean;
  /** Eligibility for all destination-indexed legs, including already completed stops. */
  legEligibility?: readonly boolean[];
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
};

/** MapLibre and the timeline both use milliseconds; playback speed scales that duration. */
export function approachAnimationDuration(approachDuration: number, speed: number) {
  return Math.max(0, approachDuration / Math.max(0.01, speed));
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
      geometry: { type: "LineString", coordinates: [[-540, lat], [540, lat]] },
    });
  for (let lon = -540; lon <= 540; lon += 15)
    features.push({
      type: "Feature",
      properties: {},
      geometry: { type: "LineString", coordinates: [[lon, -85], [lon, 85]] },
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
      "route-context": { type: "geojson", data: EMPTY_FEATURES },
      "route-completed": { type: "geojson", data: EMPTY_FEATURES },
      "route-current": { type: "geojson", data: EMPTY_FEATURES },
      "route-inferred": { type: "geojson", data: EMPTY_FEATURES },
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
        id: "route-context",
        type: "line",
        source: "route-context",
        paint: {
          "line-color": "#eac86b",
          "line-opacity": 0.22,
          "line-width": 2,
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
        id: "route-points",
        type: "circle",
        source: "route-context",
        paint: {
          "circle-color": "#f2d487",
          "circle-radius": 4,
          "circle-stroke-color": "#071014",
          "circle-stroke-width": 1.5,
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

function routeData(segments: readonly (readonly Coordinates[])[]): GeoJSON.FeatureCollection {
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
) {
  if (phase === "outro" || phase === "complete")
    return { completed: story.context, current: [] as Coordinates[][] };
  const completed: Coordinates[][] = [];
  for (let index = 1; index < activeIndex; index += 1) {
    const leg = story.legs[index];
    if (leg) completed.push(leg.drawable);
  }
  const active = story.legs[activeIndex];
  if (!active || !currentEligible)
    return { completed, current: [] as Coordinates[][] };
  if (phase === "approach")
    return { completed, current: [recordedLegPrefix(active, currentProgress)] };
  if (phase === "reveal" || phase === "hold" || phase === "departure")
    completed.push(active.drawable);
  return { completed, current: [] as Coordinates[][] };
}

export default function JourneyMap({
  activeIndex,
  photos,
  reducedMotion,
  stops,
  track,
  phase,
  dayChange = false,
  approachDuration,
  phaseRemaining,
  currentLegProgress = 0,
  currentLegEligible = false,
  legEligibility,
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
}: JourneyMapProps) {
  const mode = mapMode;
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap>();
  const moduleRef = useRef<typeof import("maplibre-gl")>();
  const markersRef = useRef(new Map<string, MapLibreMarker>());
  const activeIdRef = useRef<string>();
  const completedRef = useRef<{ engine: number; segments: readonly (readonly Coordinates[])[] }>();
  const projectionRef = useRef<"mercator" | "globe">("mercator");
  // Bumped once the engine arrives, so every effect below runs again against the live map.
  const [engine, setEngine] = useState(0);
  // Flipped once the style first loads. `isStyleLoaded` flaps while our own layer toggles
  // reload sources, so effects gate on this instead of asking per run.
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
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
  }>();
  const eligibilityKey = legEligibility?.map((eligible) => eligible ? "1" : "0").join("");
  const dayChangesKey = dayChanges?.map((change) => change ? "1" : "0").join("");
  const routeStory = useMemo(
    () => track ? buildRouteStory(track, placements, legEligibility ? [...legEligibility] : undefined) : undefined,
    // Eligibility is scalar data frequently assembled at the JSX boundary; key it by value so
    // playback renders do not rebuild recording-sized route context or recreate markers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [track, placements, eligibilityKey],
  );

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
        });
        map = instance;
        instance.addControl(
          new module.NavigationControl({ showCompass: false, visualizePitch: false }),
          "top-left",
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
        // Layout calls below need the style in place; this bump re-runs them then.
        instance.once("load", () => {
          if (active) {
            setReady(true);
            setEngine((version) => version + 1);
          }
        });
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
      resize?.disconnect();
      map?.remove();
      mapRef.current = undefined;
      moduleRef.current = undefined;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      if ((event as { sourceId?: string } | null)?.sourceId === "dem") finish(true);
    };
    const timer = window.setTimeout(() => finish(!map.isSourceLoaded("dem")), 12000);
    map.on("sourcedata", onSource);
    map.on("error", onError);
    return () => {
      window.clearTimeout(timer);
      map.off("sourcedata", onSource);
      map.off("error", onError);
    };
  }, [mode, ready, onTerrainState, engine]);

  // Static context and markers change with source data, never with the playback frame.
  useEffect(() => {
    const map = mapRef.current;
    const module = moduleRef.current;
    if (!map || !module || !ready) return;
    (map.getSource("route-context") as GeoJSONSource | undefined)?.setData(
      routeStory ? routeData(routeStory.context) : EMPTY_FEATURES,
    );
    // A dashed photo-to-photo connection is explicitly inferred and only exists without a
    // recording. A recording with sparse or singleton data must not be replaced by an invented line.
    (map.getSource("route-inferred") as GeoJSONSource | undefined)?.setData(
      track ? EMPTY_FEATURES : routeData(inferredRouteSegments(stops, dayChanges)),
    );
    for (const marker of markersRef.current.values()) marker.remove();
    const markers = new Map<string, MapLibreMarker>();
    photos.forEach((photo, index) => {
      const stop = stops[index];
      const coordinates = stop?.located ? stop.coordinates : undefined;
      if (!coordinates) return;
      // The marker element mirrors the old Leaflet structure, so the pin styling is untouched.
      const wrapper = document.createElement("div");
      wrapper.className = "pj-map-marker";
      const pin = document.createElement("div");
      pin.className = "pj-pin";
      const img = document.createElement("img");
      img.src = photo.thumbnailUrl;
      img.alt = "";
      pin.append(img);
      wrapper.append(pin);
      wrapper.title = photo.name;
      markers.set(
        photo.id,
        new module.Marker({ element: wrapper, anchor: "center" })
          .setLngLat(lngLat(coordinates))
          .addTo(map),
      );
    });
    markersRef.current = markers;
    activeIdRef.current = undefined;
    // dayChanges is commonly mapped from stable timeline stops at the JSX boundary.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos, stops, track, routeStory, dayChangesKey, ready, engine]);

  // Only the two small narrative overlays change with playback. The full recording stays in the
  // static context source, avoiding repeated work on recording-sized arrays.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (!routeStory) {
      completedRef.current = undefined;
      (map.getSource("route-completed") as GeoJSONSource | undefined)?.setData(EMPTY_FEATURES);
      (map.getSource("route-current") as GeoJSONSource | undefined)?.setData(EMPTY_FEATURES);
      return;
    }
    const visible = visibleRouteSegments(
      routeStory,
      activeIndex,
      phase,
      currentLegProgress,
      currentLegEligible,
    );
    // Completed legs are whole recorded slices that only change at a stop boundary, while this
    // effect runs on every playback frame. Re-serializing them per frame would ship the entire
    // travelled route to the GeoJSON worker 60 times a second.
    const previous = completedRef.current;
    const unchanged =
      previous?.engine === engine &&
      previous.segments.length === visible.completed.length &&
      previous.segments.every((segment, index) => segment === visible.completed[index]);
    if (!unchanged) {
      completedRef.current = { engine, segments: visible.completed };
      (map.getSource("route-completed") as GeoJSONSource | undefined)?.setData(routeData(visible.completed));
    }
    (map.getSource("route-current") as GeoJSONSource | undefined)?.setData(routeData(visible.current));
  }, [routeStory, activeIndex, phase, currentLegProgress, currentLegEligible, ready, engine]);

  // Restyle only the two markers that changed state.
  useEffect(() => {
    const markers = markersRef.current;
    const nextId = stops[activeIndex]?.located
      ? stops[activeIndex]?.photoId
      : undefined;
    if (activeIdRef.current === nextId) return;
    const previous = activeIdRef.current
      ? markers.get(activeIdRef.current)
      : undefined;
    const previousElement = previous?.getElement();
    if (previousElement) {
      previousElement.classList.remove("pj-map-marker-active");
      previousElement.style.zIndex = "";
    }
    const next = nextId ? markers.get(nextId) : undefined;
    const nextElement = next?.getElement();
    if (nextElement) {
      nextElement.classList.add("pj-map-marker-active");
      nextElement.style.zIndex = "2";
    }
    activeIdRef.current = nextId;
    // The markers effect above rebuilds every pin and clears `activeIdRef`, so this must re-run
    // on the same inputs or the rebuilt active pin keeps the inactive styling.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, photos, stops, track, routeStory, dayChangesKey, ready, engine]);

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
    map.stop();
    const previousState = cameraStateRef.current;
    cameraStateRef.current = { activeIndex, seekVersion, playing, phase };
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
    const overviewPoints = () => (track ? trackSegments(track, 60).flat() : locatedPoints(stops));
    // A long hop arcs on a globe instead of smearing across Mercator.
    const projectionPoints = overview
      ? overviewPoints()
      : [move?.from, move?.center].flatMap((point) => (point ? [point] : []));
    const globe = mode !== "offline" && legSpansGlobe(projectionPoints);
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
      const view = frameBounds(map, unwrapPoints(projectionPoints), frameRef.current, 70, maxOverviewZoom);
      if (!playing || reducedMotion) map.jumpTo({ center: view.center, zoom: view.zoom, bearing: 0, pitch: 0 });
      else map.easeTo({ center: view.center, zoom: view.zoom, bearing: 0, pitch: 0, duration: approachAnimationDuration(remainingRef.current, speed) });
      return;
    }
    if (!move) return;
    // Reposition while the opaque day card covers the map. The first uncovered frame is already
    // at the next day's real first fix, so there is no invented overnight flight or visible snap.
    if (phase === "day") {
      map.jumpTo({ center: lngLat(move.center), zoom: stopZoom, bearing: 0, pitch: 0 });
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
    if (dayChange && phase === "approach") {
      map.jumpTo({ center: lngLat(center), zoom: stopZoom, bearing: 0, pitch: 0 });
      return;
    }
    const recordedLegKnown = !track || (currentLegEligible && Boolean(routeStory?.legs[activeIndex]));
    if (reducedMotion || !playing || phase !== "approach" || !move.from || !recordedLegKnown) {
      map.jumpTo({ center: lngLat(center), zoom: stopZoom, bearing: 0, pitch: 0 });
      return;
    }
    const leg = frameBounds(map, unwrapPoints([move.from, move.center]), frameRef.current, 70, stopZoom);
    const continuing = previousState?.activeIndex === activeIndex &&
      previousState.seekVersion === seekVersion && previousState.phase === "approach";
    // Pull back once when a leg starts. Pause/resume and speed changes continue from the live
    // camera with only the remaining timeline duration; they never restart the whole leg.
    if (!continuing) map.jumpTo({ center: map.getCenter(), zoom: leg.zoom, bearing: 0, pitch: 0 });
    map.flyTo({
      center: lngLat(center),
      zoom: stopZoom,
      bearing: 0,
      pitch: 0,
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
    playing,
    speed,
    seekVersion,
    approachDuration,
    currentLegEligible,
    mode,
    ready,
    engine,
  ]);

  return (
    <div ref={containerRef} className="pj-gl-map" data-offline={mode === "offline"}>
      {failed && (
        <div className="pj-map-empty">
          <strong>3D map unavailable</strong>
          <span>The journey plays on without it. WebGL is off or unsupported here.</span>
        </div>
      )}
    </div>
  );
}

/**
 * The engine's bounds maths against the full frame instead of the map element's current size.
 * During the hero swap the element is still an inset, and a padded inset has no room at all.
 */
function frameBounds(
  map: MapLibreMap,
  points: Coordinates[],
  frame: { width: number; height: number },
  padding: number,
  maxZoom: number,
) {
  const zoom = map.getZoom();
  const projected = points.map((point) => map.project(lngLat(point)));
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
  // The map element is never larger than the frame, which is unmeasured on the first render.
  const size = map.getContainer().getBoundingClientRect();
  const width = Math.max(1, Math.max(frame.width, size.width) - padding * 2);
  const height = Math.max(1, Math.max(frame.height, size.height) - padding * 2);
  const scale = Math.min(width / Math.max(1, maxX - minX), height / Math.max(1, maxY - minY));
  // One zoom level doubles the scale, so the fitted zoom follows by log2.
  const fitted = Math.max(0, Math.min(maxZoom, zoom + Math.log2(scale)));
  const middle = map.unproject([(minX + maxX) / 2, (minY + maxY) / 2]);
  return { center: [middle.lng, middle.lat] as [number, number], zoom: fitted };
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
    return Boolean(
      canvas.getContext("webgl2") ?? canvas.getContext("webgl"),
    );
  } catch {
    return false;
  }
}
