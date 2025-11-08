import seedrandom from "seedrandom";

interface PatternProps {
  seed: string;
  colorClass?: string;
  opacity?: string;
  gridSize?: number; // Number of cells in the grid
  spacing?: number; // Spacing between grid points
  lineVariance?: number; // Randomness applied to line connections
}

export function Pattern({
  seed: initialSeed,
  colorClass = "text-primary",
  opacity = "0.4",
  gridSize = 10,
  spacing = 50,
  lineVariance = 10,
}: PatternProps) {
  const seed = colorClass + initialSeed;
  const rng = seedrandom(seed);
  const patternId = `pattern-${seed.replace(/\s+/g, "-")}-${colorClass}`;

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
    });

    return paths.join(" ");
  };

  const points = generateGridPoints();
  const paths = generatePaths(points);

  return (
    <div className="absolute inset-0 overflow-hidden">
      <svg className={`h-full w-full ${colorClass}`} style={{ opacity }}>
        <defs>
          <pattern
            id={patternId}
            x="0"
            y="0"
            width={gridSize * spacing}
            height={gridSize * spacing}
            patternUnits="userSpaceOnUse"
          >
            {/* Draw grid points */}
            {points.map((point, index) => (
              <circle
                key={index}
                cx={point.x}
                cy={point.y}
                r="3"
                className="fill-current"
              />
            ))}

            {/* Draw connecting lines */}
            <path
              d={paths}
              className="stroke-current"
              fill="none"
              strokeWidth="1"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${patternId})`} />
      </svg>
    </div>
  );
}
