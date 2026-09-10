import { distanceKm } from './timeline';
import type { Coordinates } from './types';

type PlaceData = { countries: Record<string, string>; cities: unknown[][] };

let dataset: Promise<PlaceData> | undefined;
/** The 158 KB list is a separate chunk, so a journey with no GPS never downloads it. */
function loadPlaces() {
  return (dataset ??= import('./places.json').then((module) => module.default as PlaceData));
}

/** Approximate nearest populated place, using only the bundled GeoNames data. */
export function nearestPlaceIn(data: PlaceData, point: Coordinates) {
  let closest: { name: string; country: string; distanceKm: number } | undefined;
  for (const row of data.cities) {
    const [name, code, latitude, longitude] = row;
    if (typeof name !== 'string' || typeof code !== 'string' || typeof latitude !== 'number' || typeof longitude !== 'number') continue;
    const distance = distanceKm(point, { latitude, longitude });
    if (!closest || distance < closest.distanceKm) closest = { name, country: data.countries[code] ?? code, distanceKm: distance };
  }
  return closest ? `near ${closest.name}, ${closest.country}` : undefined;
}

export async function nearestPlace(point: Coordinates) {
  return nearestPlaceIn(await loadPlaces(), point);
}
