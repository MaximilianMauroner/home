import data from './places.json';
import { distanceKm } from './timeline';
import type { Coordinates } from './types';

/** Approximate nearest populated place, using only the bundled GeoNames data. */
export function nearestPlace(point: Coordinates) {
  let closest: { name: string; country: string; distanceKm: number } | undefined;
  const countries: Record<string, string> = data.countries;
  for (const row of data.cities) {
    const [name, code, latitude, longitude] = row;
    if (typeof name !== 'string' || typeof code !== 'string' || typeof latitude !== 'number' || typeof longitude !== 'number') continue;
    const distance = distanceKm(point, { latitude, longitude });
    if (!closest || distance < closest.distanceKm) closest = { name, country: countries[code] ?? code, distanceKm: distance };
  }
  return closest ? `near ${closest.name}, ${closest.country}` : undefined;
}
