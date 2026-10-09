import { useEffect, useRef, useState, type RefObject } from "react";
import {
  createTimelineFlightPath,
  pointAtFlightDistance,
} from "./timelineFlightPath";

type TimelineFlightPath = {
  height: number;
  path: string;
  samples: ReturnType<typeof createTimelineFlightPath>["samples"];
  length: number;
  ship: {
    angle: number;
    x: number;
    y: number;
  };
  width: number;
};

export function useTimelineFlight(
  chaptersRef: RefObject<HTMLDivElement>,
  visibleItemKey: string,
  prefersReducedMotion: boolean,
) {
  const [flightPath, setFlightPath] = useState<TimelineFlightPath | null>(null);
  const [shipDocked, setShipDocked] = useState(true);
  const spaceshipRef = useRef<SVGGElement>(null);

  useEffect(() => {
    const container = chaptersRef.current;
    if (!container) return;

    let frame = 0;
    const updateFlightPath = () => {
      const containerBounds = container.getBoundingClientRect();
      const entries = Array.from(
        container.querySelectorAll<HTMLElement>("[data-timeline-entry]"),
      );
      const destination = container.querySelector<HTMLElement>(
        "[data-flight-destination]",
      );
      const launchButton = document.querySelector<HTMLElement>(
        "[data-timeline-launch-button]",
      );

      if (entries.length === 0) {
        setFlightPath(null);
        return;
      }

      const points = entries
        .map((entry) => {
          const bounds = entry.getBoundingClientRect();
          return {
            top: bounds.top - containerBounds.top,
            x: bounds.left - containerBounds.left + bounds.width / 2,
            y: bounds.top - containerBounds.top + bounds.height / 2,
          };
        })
        .sort((a, b) => a.top - b.top || a.x - b.x);

      const firstPoint = points[0];
      const launchBounds = launchButton
        ?.querySelector<HTMLElement>("[data-timeline-button-dock]")
        ?.getBoundingClientRect();
      const routeStart = launchBounds
        ? {
            x:
              launchBounds.left - containerBounds.left + launchBounds.width / 2,
            y: launchBounds.top - containerBounds.top + launchBounds.height / 2,
          }
        : { x: 12, y: firstPoint.top + 20 };
      const routePoints = [
        ...(launchBounds ? [routeStart] : []),
        { x: 12, y: firstPoint.top + 20 },
        ...points.map(({ x, y }) => ({ x, y })),
        ...(destination
          ? [
              {
                x:
                  destination.getBoundingClientRect().left -
                  containerBounds.left +
                  destination.getBoundingClientRect().width / 2,
                y:
                  destination.getBoundingClientRect().top -
                  containerBounds.top +
                  destination.getBoundingClientRect().height / 2,
              },
            ]
          : []),
      ];
      const geometry = createTimelineFlightPath(routePoints);

      const shipTarget = routePoints[1];
      const nextFlightPath: TimelineFlightPath = {
        height: containerBounds.height,
        ...geometry,
        ship: {
          angle:
            (Math.atan2(
              shipTarget.y - routePoints[0].y,
              shipTarget.x - routePoints[0].x,
            ) *
              180) /
            Math.PI,
          x: routePoints[0].x,
          y: routePoints[0].y,
        },
        width: containerBounds.width,
      };
      setFlightPath((current) =>
        current?.height === nextFlightPath.height &&
        current.path === nextFlightPath.path &&
        current.ship.angle === nextFlightPath.ship.angle &&
        current.ship.x === nextFlightPath.ship.x &&
        current.ship.y === nextFlightPath.ship.y &&
        current.width === nextFlightPath.width
          ? current
          : nextFlightPath,
      );
    };

    const scheduleUpdate = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(updateFlightPath);
    };
    const observer = new ResizeObserver(scheduleUpdate);
    observer.observe(container);
    container
      .querySelectorAll<HTMLElement>("[data-timeline-entry]")
      .forEach((entry) => observer.observe(entry));
    const destination = container.querySelector<HTMLElement>(
      "[data-flight-destination]",
    );
    if (destination) observer.observe(destination);
    const launchButton = document.querySelector<HTMLElement>(
      "[data-timeline-launch-button]",
    );
    if (launchButton) observer.observe(launchButton);
    window.addEventListener("resize", scheduleUpdate);
    scheduleUpdate();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", scheduleUpdate);
    };
  }, [chaptersRef, visibleItemKey]);

  useEffect(() => {
    const container = chaptersRef.current;
    const spaceship = spaceshipRef.current;
    if (!container || !spaceship || !flightPath) return;

    const pathLength = flightPath.length;
    if (pathLength === 0) return;
    const pathSamples: typeof flightPath.samples = [];
    for (const point of flightPath.samples) {
      const previous = pathSamples.at(-1);
      if (!previous || point.y > previous.y) pathSamples.push(point);
    }

    const getDistanceForY = (targetY: number) => {
      let lowerIndex = 0;
      let upperIndex = pathSamples.length - 1;
      while (lowerIndex < upperIndex) {
        const middleIndex = Math.floor((lowerIndex + upperIndex) / 2);
        if (pathSamples[middleIndex].y < targetY) {
          lowerIndex = middleIndex + 1;
        } else {
          upperIndex = middleIndex;
        }
      }

      const upper = pathSamples[lowerIndex];
      const lower = pathSamples[Math.max(0, lowerIndex - 1)];
      const segmentHeight = upper.y - lower.y;
      const interpolation =
        segmentHeight === 0
          ? 0
          : Math.max(0, Math.min(1, (targetY - lower.y) / segmentHeight));
      return lower.distance + (upper.distance - lower.distance) * interpolation;
    };

    let frame = 0;
    let currentDistance: number | null = null;
    let targetDistance = 0;
    let minimumDistance = 0;
    let maximumDistance = pathLength;
    let velocity = 0;
    let previousTimestamp = 0;
    const renderSpaceship = (distance: number) => {
      const progress = Math.max(0, Math.min(1, distance / pathLength));
      const point = pointAtFlightDistance(flightPath.samples, distance);
      const nextPoint = pointAtFlightDistance(
        flightPath.samples,
        Math.min(pathLength, distance + 2),
      );
      const angle =
        (Math.atan2(nextPoint.y - point.y, nextPoint.x - point.x) * 180) /
        Math.PI;

      spaceship.setAttribute(
        "transform",
        `translate(${point.x} ${point.y}) rotate(${distance < 0.01 ? 90 : angle}) scale(1.2)`,
      );
      spaceship.dataset.flightProgress = progress.toFixed(4);
      if (
        targetDistance <= pathLength * 0.001 &&
        distance <= pathLength * 0.0015
      ) {
        setShipDocked(true);
      }
    };

    const updateTarget = () => {
      const containerBounds = container.getBoundingClientRect();
      const viewportGuide = window.innerHeight * 0.45;
      const travelRange = Math.max(
        1,
        containerBounds.height - window.innerHeight + viewportGuide,
      );
      const scrollProgress = Math.max(
        0,
        Math.min(1, (viewportGuide - containerBounds.top) / travelRange),
      );
      const pacedDistance = pathLength * scrollProgress;
      minimumDistance = getDistanceForY(
        window.innerHeight * 0.18 - containerBounds.top,
      );
      maximumDistance = getDistanceForY(
        window.innerHeight * 0.72 - containerBounds.top,
      );
      targetDistance = Math.max(
        minimumDistance,
        Math.min(maximumDistance, pacedDistance),
      );
      if (targetDistance > pathLength * 0.001) setShipDocked(false);
      spaceship.dataset.flightTargetProgress = Math.max(
        0,
        Math.min(1, targetDistance / pathLength),
      ).toFixed(4);

      if (currentDistance === null) {
        currentDistance = targetDistance;
        renderSpaceship(currentDistance);
        return;
      }

      const constrainedDistance = Math.max(
        minimumDistance,
        Math.min(maximumDistance, currentDistance),
      );
      if (constrainedDistance !== currentDistance) {
        currentDistance = constrainedDistance;
        velocity *= 0.25;
      }

      if (frame === 0) {
        previousTimestamp = performance.now();
        frame = requestAnimationFrame(animateSpaceship);
      }
    };

    const animateSpaceship = (timestamp: number) => {
      frame = 0;
      if (currentDistance === null) return;

      const deltaTime = Math.min(0.032, (timestamp - previousTimestamp) / 1000);
      previousTimestamp = timestamp;
      const displacement = targetDistance - currentDistance;
      const acceleration = displacement * 90 - velocity * 13;
      velocity = Math.max(
        -1000,
        Math.min(1000, velocity + acceleration * deltaTime),
      );
      currentDistance += velocity * deltaTime;

      if (
        currentDistance < minimumDistance ||
        currentDistance > maximumDistance
      ) {
        currentDistance = Math.max(
          minimumDistance,
          Math.min(maximumDistance, currentDistance),
        );
        velocity *= -0.12;
      }

      const remainingDistance = targetDistance - currentDistance;
      if (Math.abs(remainingDistance) < 0.35 && Math.abs(velocity) < 2) {
        currentDistance = targetDistance;
        velocity = 0;
        renderSpaceship(currentDistance);
        return;
      }

      renderSpaceship(currentDistance);
      frame = requestAnimationFrame(animateSpaceship);
    };
    const scheduleUpdate = () => {
      updateTarget();
    };

    if (prefersReducedMotion) {
      spaceship.setAttribute(
        "transform",
        `translate(${flightPath.ship.x} ${flightPath.ship.y}) rotate(${flightPath.ship.angle}) scale(1.2)`,
      );
      spaceship.dataset.flightProgress = "0.0000";
      setShipDocked(false);
      return;
    }

    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    const handleResize = () => {
      currentDistance = null;
      velocity = 0;
      cancelAnimationFrame(frame);
      frame = 0;
      scheduleUpdate();
    };
    window.addEventListener("resize", handleResize);
    scheduleUpdate();

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", handleResize);
    };
  }, [chaptersRef, flightPath, prefersReducedMotion]);

  return { flightPath, spaceshipRef, shipDocked };
}
