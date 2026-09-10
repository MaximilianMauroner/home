import { useEffect, useRef, useState } from "react";
import type {
  GeoJSONSource,
  Map as MapLibreMap,
  Marker as MapLibreMarker,
  StyleSpecification,
} from "maplibre-gl";

import { trackSegments, type Track } from "./gpx";
import {
  cameraFor,
  locatedPoints,
  routeSegments,
  type JourneyStop,
  type JourneyPhase,
} from "./timeline";
import type { Coordinates, JourneyPhoto } from "./types";

/** Street level for map tiles. The offline outline has no detail past regional scale. */
const STOP_ZOOM = 13;
const OFFLINE_STOP_ZOOM = 6;
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
  approachDuration: number;
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
      route: { type: "geojson", data: EMPTY_FEATURES },
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
        id: "route-halo",
        type: "line",
        source: "route",
        paint: {
          "line-color": "#eac86b",
          "line-opacity": 0.18,
          "line-width": 7,
        },
      },
      {
        id: "route-core",
        type: "line",
        source: "route",
        layout: { "line-cap": "round" },
        paint: {
          "line-color": "#f2d487",
          "line-opacity": 0.95,
          "line-width": 2.5,
        },
      },
      {
        id: "route-core-dash",
        type: "line",
        source: "route",
        layout: { "line-cap": "round" },
        paint: {
          "line-color": "#f2d487",
          "line-opacity": 0.95,
          "line-width": 2.5,
          "line-dasharray": [0.8, 2.8],
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

export default function JourneyMap({
  activeIndex,
  photos,
  reducedMotion,
  stops,
  track,
  phase,
  approachDuration,
  mapMode = "offline",
  playing,
  speed,
  seekVersion,
  frame,
  onMarkerPosition,
  onTerrainState,
  onEngineFailed,
}: JourneyMapProps) {
  const mode: MapMode = mapMode;
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap>();
  const moduleRef = useRef<typeof import("maplibre-gl")>();
  const markersRef = useRef(new Map<string, MapLibreMarker>());
  const activeIdRef = useRef<string>();
  const pitchRef = useRef<{ key: string; pitched: boolean }>({ key: "", pitched: false });
  const bearingRef = useRef("");
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
  const cameraStateRef = useRef<{
    activeIndex: number;
    seekVersion: number;
    playing: boolean;
  }>();

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
  }, [mode, ready]);

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
  }, [mode, ready, onTerrainState]);

  // The route and the markers only change when the photo set changes. Rebuilding them per stop
  // would recreate every marker on the map on every beat of the journey.
  useEffect(() => {
    const map = mapRef.current;
    const module = moduleRef.current;
    if (!map || !module || !ready) return;
    // A recorded track is the route when there is one: the walk, not the shortcut between photos.
    const walked = track ? trackSegments(track) : undefined;
    const lines = walked?.length
      ? walked.flatMap((segment) => routeSegments(segment))
      : routeSegments(locatedPoints(stops));
    (map.getSource("route") as GeoJSONSource | undefined)?.setData({
      type: "FeatureCollection",
      features: lines.map((segment) => ({
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates: segment.map((point) => [point.longitude, point.latitude]),
        },
      })),
    });
    // The dashed line reads as "as the crow flies"; the solid one as "walked".
    const dashed = !walked?.length;
    map.setLayoutProperty("route-core", "visibility", dashed ? "none" : "visible");
    map.setLayoutProperty("route-core-dash", "visibility", dashed ? "visible" : "none");
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
  }, [photos, stops, track, ready]);

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
  }, [activeIndex, stops, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
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
    if (!map) return;
    map.stop();
    const previousState = cameraStateRef.current;
    cameraStateRef.current = { activeIndex, seekVersion, playing };
    if (
      !playing &&
      previousState?.playing &&
      previousState.activeIndex === activeIndex &&
      previousState.seekVersion === seekVersion
    )
      return;
    const stopZoom = mode === "offline" ? OFFLINE_STOP_ZOOM : STOP_ZOOM;
    const overview =
      phase === "intro" ||
      phase === "outro" ||
      phase === "complete" ||
      phase === "overview";
    const move = cameraFor(stops, activeIndex);
    // A long hop arcs on a globe instead of smearing across Mercator.
    const overviewPoints = track
      ? trackSegments(track, 60).flat()
      : locatedPoints(stops);
    const projectionPoints = overview
      ? overviewPoints
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
      if (!overviewPoints.length) return;
      const view = frameBounds(map, unwrapPoints(overviewPoints), frameRef.current, 70, stopZoom);
      if (!playing || reducedMotion) map.jumpTo({ center: view.center, zoom: view.zoom, bearing: 0 });
      else map.easeTo({ center: view.center, zoom: view.zoom, bearing: 0, duration: 1000 });
      return;
    }
    if (!move) return;
    // A day card holds the previous stop, so the next leg still starts from there.
    if (phase === "day") {
      if (!playing)
        map.jumpTo({
          center: lngLat(move.from ?? move.center),
          zoom: stopZoom,
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
    if (reducedMotion || !playing || phase !== "approach" || !move.from) {
      map.jumpTo({ center: lngLat(center), zoom: stopZoom });
      return;
    }
    const leg = frameBounds(map, unwrapPoints([move.from, move.center]), frameRef.current, 70, stopZoom);
    // The leg's bounds select its pull-back; the engine performs each animation itself.
    // Bearing snaps straight here so the flight itself never un-rotates a hold drift.
    map.jumpTo({ center: map.getCenter(), zoom: leg.zoom, bearing: 0 });
    map.flyTo({
      center: lngLat(center),
      zoom: stopZoom,
      duration: approachDuration / 1000 / speed,
    });
  }, [
    activeIndex,
    phase,
    reducedMotion,
    stops,
    track,
    playing,
    speed,
    seekVersion,
    approachDuration,
    mode,
    engine,
  ]);

  // The last 600 ms of the approach tip toward the horizon, so the ridge stands up exactly as
  // the photo takes the frame. Flat modes never pitch: only chosen terrain spends the GPU.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || mode !== "terrain") return;
    const key = `${activeIndex}:${seekVersion}`;
    const arriving =
      playing && !reducedMotion && (phase === "reveal" || phase === "hold");
    const pitched = pitchRef.current;
    if (pitched.key === key && pitched.pitched === arriving) return;
    pitchRef.current = { key, pitched: arriving };
    map.easeTo({ pitch: arriving ? TERRAIN_PITCH : 0, duration: arriving ? 600 : 300 });
  }, [mode, phase, playing, reducedMotion, activeIndex, seekVersion, engine]);

  // A slow drift during the hold reads as a real camera move on pitched terrain.
  // Straightening happens in the camera effect, never here: two eases would fight the flight.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || mode === "offline") return;
    const key = `${activeIndex}:${seekVersion}:${phase}`;
    if (bearingRef.current === key) return;
    bearingRef.current = key;
    if (playing && !reducedMotion && phase === "hold")
      map.easeTo({ bearing: map.getBearing() + 12, duration: 4000 });
  }, [mode, phase, playing, reducedMotion, activeIndex, seekVersion, engine]);

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
  const minX = Math.min(...projected.map((point) => point.x));
  const maxX = Math.max(...projected.map((point) => point.x));
  const minY = Math.min(...projected.map((point) => point.y));
  const maxY = Math.max(...projected.map((point) => point.y));
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
