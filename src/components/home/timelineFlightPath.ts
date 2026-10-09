type Point = { x: number; y: number };
type Sample = Point & { distance: number };

// Sample the cubic curves directly. SVG getPointAtLength becomes costly on a
// long timeline, especially when repeated during every animation frame.
export function createTimelineFlightPath(points: Point[]) {
  const samples: Sample[] = [{ ...points[0], distance: 0 }];
  let path = `M ${points[0].x} ${points[0].y}`;

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const deltaX = current.x - previous.x;
    const deltaY = current.y - previous.y;
    const middleY = previous.y + deltaY / 2;
    const direction = index === 1 || index % 2 === 0 ? 1 : -1;
    const curve = Math.min(72, Math.max(24, Math.abs(deltaY) * 0.12));
    const bend = index % 2 === 0 ? 18 : -18;
    const first =
      Math.abs(deltaY) < 32
        ? { x: previous.x + deltaX * 0.34, y: previous.y + bend }
        : { x: previous.x + curve * direction, y: middleY };
    const second =
      Math.abs(deltaY) < 32
        ? { x: current.x - deltaX * 0.34, y: current.y + bend }
        : { x: current.x - curve * direction, y: middleY };
    path += ` C ${first.x} ${first.y}, ${second.x} ${second.y}, ${current.x} ${current.y}`;

    for (let step = 1; step <= 24; step += 1) {
      const t = step / 24;
      const inverse = 1 - t;
      const x =
        inverse ** 3 * previous.x +
        3 * inverse ** 2 * t * first.x +
        3 * inverse * t ** 2 * second.x +
        t ** 3 * current.x;
      const y =
        inverse ** 3 * previous.y +
        3 * inverse ** 2 * t * first.y +
        3 * inverse * t ** 2 * second.y +
        t ** 3 * current.y;
      const last = samples[samples.length - 1];
      samples.push({
        x,
        y,
        distance: last.distance + Math.hypot(x - last.x, y - last.y),
      });
    }
  }

  return { path, samples, length: samples[samples.length - 1].distance };
}

export function pointAtFlightDistance(samples: Sample[], distance: number) {
  let lower = 0;
  let upper = samples.length - 1;
  while (lower < upper) {
    const middle = Math.floor((lower + upper) / 2);
    if (samples[middle].distance < distance) lower = middle + 1;
    else upper = middle;
  }
  const end = samples[lower];
  const start = samples[Math.max(0, lower - 1)];
  const span = end.distance - start.distance;
  const t =
    span === 0
      ? 0
      : Math.max(0, Math.min(1, (distance - start.distance) / span));
  return {
    x: start.x + (end.x - start.x) * t,
    y: start.y + (end.y - start.y) * t,
  };
}
