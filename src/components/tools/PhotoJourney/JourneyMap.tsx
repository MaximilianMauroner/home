import L from "leaflet";
import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

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
const BASE_PANE = "pj-base";

type JourneyMapProps = {
  activeIndex: number;
  photos: JourneyPhoto[];
  reducedMotion: boolean;
  stops: JourneyStop[];
  phase: JourneyPhase;
  approachDuration: number;
  offline: boolean;
  playing: boolean;
  speed: number;
  seekVersion: number;
  /** The full stage size. The map element can still be growing out of its corner inset. */
  frame: { width: number; height: number };
  onMarkerPosition?: (point: { x: number; y: number } | null) => void;
};

function latLng({ latitude, longitude }: Coordinates): L.LatLngTuple {
  return [latitude, longitude];
}

export default function JourneyMap({
  activeIndex,
  photos,
  reducedMotion,
  stops,
  phase,
  approachDuration,
  offline,
  playing,
  speed,
  seekVersion,
  frame,
  onMarkerPosition,
}: JourneyMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map>();
  const markersRef = useRef(new Map<string, L.Marker>());
  const activeIdRef = useRef<string>();
  // Read at command time only: a resize must not restart a camera move.
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const cameraStateRef = useRef<{
    activeIndex: number;
    seekVersion: number;
    playing: boolean;
  }>();

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      attributionControl: true,
      zoomControl: false,
      worldCopyJump: true,
    }).setView([0, 0], 2);
    /* Tiles are attached separately so offline mode never creates a tile layer. */
    L.control.zoom({ position: "topleft" }).addTo(map);
    // The offline outline sits between tiles and the route, whatever order the layers load in.
    map.createPane(BASE_PANE).style.zIndex = "250";
    mapRef.current = map;
    const resize = new ResizeObserver(() =>
      map.invalidateSize({ animate: false }),
    );
    resize.observe(containerRef.current);
    return () => {
      resize.disconnect();
      map.remove();
      mapRef.current = undefined;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (offline) {
      map.setMaxZoom(OFFLINE_MAX_ZOOM);
      const base = L.layerGroup().addTo(map);
      const line = { color: "#1a2c33", weight: 1, interactive: false, pane: BASE_PANE };
      for (let lat = -75; lat <= 75; lat += 15)
        L.polyline([[lat, -540], [lat, 540]], line).addTo(base);
      for (let lon = -540; lon <= 540; lon += 15)
        L.polyline([[-85, lon], [85, lon]], line).addTo(base);
      let active = true;
      // The outline is a separate chunk, so the tiles mode never downloads it.
      void import("./land.json").then(({ default: rings }) => {
        if (!active) return;
        const shapes = rings.map((ring) => ring.map(([lon, lat]): L.LatLngTuple => [lat, lon]));
        // Three world copies keep land visible when a leg crosses the antimeridian.
        for (const shift of [-360, 0, 360])
          L.polygon(
            shapes.map((shape) => [shape.map(([lat, lon]): L.LatLngTuple => [lat, lon + shift])]),
            { color: "#2a434b", weight: 1, fillColor: "#132328", fillOpacity: 1, interactive: false, pane: BASE_PANE },
          ).addTo(base);
      });
      return () => {
        active = false;
        base.remove();
      };
    }
    map.setMaxZoom(19);
    const tiles = L.tileLayer(
      "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      },
    ).addTo(map);
    return () => {
      tiles.remove();
    };
  }, [offline]);

  // The route and the markers only change when the photo set changes. Rebuilding them per stop
  // would recreate every marker on the map on every beat of the journey.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const layer = L.layerGroup().addTo(map);
    const markers = new Map<string, L.Marker>();
    routeSegments(locatedPoints(photos)).forEach((segment) => {
      const points = segment.map(latLng);
      L.polyline(points, { color: "#eac86b", opacity: 0.18, weight: 7, interactive: false }).addTo(layer);
      L.polyline(points, { color: "#f2d487", dashArray: "2 7", lineCap: "round", opacity: 0.95, weight: 2.5, interactive: false }).addTo(layer);
    });
    photos.forEach((photo) => {
      const coordinates = photo.metadata.coordinates;
      if (!coordinates) return;
      const tooltip = document.createElement("span");
      tooltip.textContent = photo.name;
      markers.set(
        photo.id,
        L.marker(latLng(coordinates), { icon: thumbnailIcon(photo) })
          .bindTooltip(tooltip)
          .addTo(layer),
      );
    });
    markersRef.current = markers;
    activeIdRef.current = undefined;
    return () => {
      layer.remove();
      markersRef.current = new Map();
    };
  }, [photos]);

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
    previous?.getElement()?.classList.remove("pj-map-marker-active");
    const next = nextId ? markers.get(nextId) : undefined;
    next?.getElement()?.classList.add("pj-map-marker-active");
    previous?.setZIndexOffset(0);
    next?.setZIndexOffset(1000);
    activeIdRef.current = nextId;
  }, [activeIndex, stops]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const emit = () => {
      const position = stops[activeIndex]?.coordinates;
      const point = position
        ? map.latLngToContainerPoint(latLng(position))
        : null;
      onMarkerPosition?.(point ? { x: point.x, y: point.y } : null);
    };
    emit();
    map.on("move resize", emit);
    return () => {
      map.off("move resize", emit);
    };
  }, [activeIndex, stops, onMarkerPosition]);

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
    const stopZoom = offline ? OFFLINE_STOP_ZOOM : STOP_ZOOM;
    const overview =
      phase === "intro" ||
      phase === "outro" ||
      phase === "complete" ||
      phase === "overview";
    if (overview) {
      const points = locatedPoints(photos);
      if (!points.length) return;
      const view = frameBounds(map, unwrapPoints(points), frameRef.current, 70, stopZoom);
      map.setView(view.center, view.zoom, { animate: !reducedMotion && playing });
      return;
    }
    const move = cameraFor(stops, activeIndex);
    if (!move) return;
    // A day card holds the previous stop, so the next leg still starts from there.
    if (phase === "day") {
      if (!playing) map.setView(latLng(move.from ?? move.center), stopZoom, { animate: false });
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
      map.setView(latLng(center), stopZoom, { animate: false });
      return;
    }
    const leg = frameBounds(map, unwrapPoints([move.from, move.center]), frameRef.current, 70, stopZoom);
    // The leg's bounds select its pull-back; Leaflet performs each animation itself.
    map.setView(map.getCenter(), leg.zoom, { animate: false });
    map.flyTo(latLng(center), stopZoom, {
      duration: approachDuration / 1000 / speed,
    });
  }, [
    activeIndex,
    phase,
    reducedMotion,
    stops,
    photos,
    playing,
    speed,
    seekVersion,
    approachDuration,
    offline,
  ]);

  return (
    <div
      ref={containerRef}
      className="pj-leaflet-map"
      data-offline={offline}
    />
  );
}

function thumbnailIcon(photo: JourneyPhoto) {
  // Leaflet positions the icon element with a transform, so all styling and scaling goes on
  // an inner element. A CSS scale on the icon itself would also scale its map position.
  const pin = document.createElement("div");
  pin.className = "pj-pin";
  const img = document.createElement("img");
  img.src = photo.thumbnailUrl;
  img.alt = "";
  pin.append(img);
  return L.divIcon({
    html: pin,
    className: "pj-map-marker",
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
}
/**
 * Leaflet's fitBounds maths against the full frame instead of the map element's current size.
 * During the hero swap the element is still an inset, and a padded inset has no room at all.
 */
function frameBounds(
  map: L.Map,
  points: Coordinates[],
  frame: { width: number; height: number },
  padding: number,
  maxZoom: number,
) {
  const bounds = L.latLngBounds(points.map(latLng));
  const zoom = map.getZoom();
  const nw = map.project(bounds.getNorthWest(), zoom);
  const se = map.project(bounds.getSouthEast(), zoom);
  // The map element is never larger than the frame, which is unmeasured on the first render.
  const size = map.getSize();
  const width = Math.max(1, Math.max(frame.width, size.x) - padding * 2);
  const height = Math.max(1, Math.max(frame.height, size.y) - padding * 2);
  const scale = Math.min(width / Math.max(1, se.x - nw.x), height / Math.max(1, se.y - nw.y));
  return {
    center: map.unproject(nw.add(se).divideBy(2), zoom),
    zoom: Math.max(map.getMinZoom(), Math.min(maxZoom, Math.floor(map.getScaleZoom(scale, zoom)))),
  };
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
