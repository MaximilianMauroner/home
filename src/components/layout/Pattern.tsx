import seedrandom from "seedrandom";

interface PatternProps {
  seed: string;
  colorClass?: string;
  opacity?: string;
  gridSize?: number; // Number of cells in the grid
  spacing?: number; // Spacing between grid points
  lineVariance?: number; // Randomness applied to line connections
  className?: string;
}

export function Pattern({
  seed: initialSeed,
  colorClass = "text-primary",
  opacity = "0.4",
  gridSize = 10,
  spacing = 50,
  lineVariance = 10,
  className = "",
}: PatternProps) {
  const seed = colorClass + initialSeed;
  const rng = seedrandom(seed);
  const sanitizedSeed = seed.replace(/[^a-zA-Z0-9-_]/g, "-");
  const sanitizedColorClass = colorClass.replace(/[^a-zA-Z0-9-_]/g, "-");
  const patternId = `pattern-${sanitizedSeed}-${sanitizedColorClass}`;
  const gradientId = `${patternId}-gradient`;
  const glowId = `${patternId}-glow`;

  // Generate grid points in a structured way
  const generateGridPoints = () => {
    const points: { x: number; y: number }[] = [];

    for (let x = 0; x <= gridSize; x++) {
      for (let y = 0; y <= gridSize; y++) {
        const jitterX = rng() * lineVariance - lineVariance / 2;
        const jitterY = rng() * lineVariance - lineVariance / 2;
        points.push({
          x: x * spacing + jitterX,
          y: y * spacing + jitterY,
        });
      }
    }
    return points;
  };

  // Generate paths connecting points
  const generatePaths = (points: { x: number; y: number }[]) => {
    const paths: string[] = [];
    const rows = Math.sqrt(points.length);
    const diagonalChance = 0.25 + rng() * 0.35;
    const curvedChance = 0.15 + rng() * 0.25;

    points.forEach((point, index) => {
      // Connect horizontally
      if ((index + 1) % rows !== 0) {
        const next = points[index + 1];
        paths.push(`M ${point.x},${point.y} L ${next.x},${next.y}`);
      }

      // Connect vertically
      const below = points[index + rows];
      if (below) {
        paths.push(`M ${point.x},${point.y} L ${below.x},${below.y}`);
      }

      // Occasionally connect diagonally for visual interest
      if ((index + 1) % rows !== 0 && below && rng() < diagonalChance) {
        const diagonal = points[index + rows + 1];
        if (diagonal) {
          paths.push(`M ${point.x},${point.y} L ${diagonal.x},${diagonal.y}`);
        }
      }

      // Add soft bezier curves between random neighbors
      if ((index + 1) % rows !== 0 && rng() < curvedChance) {
        const controlOffsetX = (rng() - 0.5) * spacing;
        const controlOffsetY = (rng() - 0.5) * spacing;
        const next = points[index + 1];
        if (next) {
          paths.push(
            `M ${point.x},${point.y} Q ${point.x + controlOffsetX},${point.y + controlOffsetY} ${next.x},${next.y}`
          );
        }
      }
    });

    return paths.join(" ");
  };

  const points = generateGridPoints();
  const paths = generatePaths(points);
  // Create highlighted nodes to emphasize certain points
  const highlightedPoints = points.filter(() => rng() > 0.8);

  return (
    <div className={`absolute inset-0 overflow-hidden ${className}`}>
      <svg className={`h-full w-full ${colorClass}`} style={{ opacity }}>
        <defs>
          <radialGradient id={gradientId} cx="50%" cy="50%" r="75%">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.5" />
            <stop offset="55%" stopColor="currentColor" stopOpacity="0.22" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </radialGradient>
          <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="8" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <pattern
            id={patternId}
            x="0"
            y="0"
            width={gridSize * spacing}
            height={gridSize * spacing}
            patternUnits="userSpaceOnUse"
          >
            <rect
              width="100%"
              height="100%"
              fill={`url(#${gradientId})`}
              opacity="0.9"
            />
            <rect
              width="100%"
              height="100%"
              fill="currentColor"
              opacity="0.08"
            />
            {/* Draw grid points */}
            {points.map((point, index) => (
              <circle
                key={index}
                cx={point.x}
                cy={point.y}
                r="3.5"
                className="fill-current"
                opacity="0.9"
              />
            ))}

            {/* Highlighted nodes */}
            {highlightedPoints.map((point, index) => (
              <circle
                key={`highlight-${index}`}
                cx={point.x}
                cy={point.y}
                r="5.5"
                className="fill-current"
                opacity="0.22"
                filter={`url(#${glowId})`}
              />
            ))}

            {/* Draw connecting lines */}
            <path
              d={paths}
              className="stroke-current"
              fill="none"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeOpacity={0.82}
              filter={`url(#${glowId})`}
            />
            <path
              d={paths}
              className="stroke-current"
              fill="none"
              strokeWidth="0.55"
              strokeLinecap="round"
              strokeOpacity={0.45}
              strokeDasharray="5 11"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${patternId})`} />
      </svg>
    </div>
  );
}
