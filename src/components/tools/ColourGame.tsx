import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type ColourBlock = {
  colour: string;
  isTarget: boolean;
};

type GameGenerationResult = {
  grid: ColourBlock[][];
  targetAlpha: number;
  baseAlpha: number;
};

const START_AMOUNT = 20;
const START_LEVEL = 50;
const MAX_AMOUNT = 50;
const MAX_LEVEL = 100;

const STORAGE_KEYS = {
  state: "last-state",
  amount: "last-amount",
  level: "last-level",
  count: "last-count",
} as const;

const readNumberFromStorage = (key: string, fallback: number) => {
  if (typeof window === "undefined") {
    return fallback;
  }

  const value = window.localStorage.getItem(key);
  if (value === null) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const hextToAlpha = (hex: string) => {
  if (!hex || hex.length < 9) {
    return 0;
  }
  return Number.parseInt(hex.slice(7, 9), 16);
};

function rgbToHex(value: number) {
  const hex = Number(value).toString(16);
  return hex.length < 2 ? `0${hex}` : hex;
}

function fullColorHex(r: number, g: number, b: number, a: number) {
  const red = rgbToHex(r);
  const green = rgbToHex(g);
  const blue = rgbToHex(b);
  const alpha = rgbToHex(a);

  return {
    hex: `#${red}${green}${blue}${alpha}`,
    red,
    green,
    blue,
    alpha,
  };
}

function getBiasedRandomAbovePercent(difficulty: number, bias = 1.5): number {
  const percent = Math.max(0, Math.min(100, difficulty));
  const minimum = percent * bias;

  if (minimum >= 100) {
    return getBiasedRandomAbovePercent(difficulty, bias - 0.1);
  }

  const maximum = 99.99999999;
  const randomValue = Math.random();
  const randomNumber = minimum - randomValue * (maximum - minimum);
  return Math.floor((randomNumber / 100) * 255);
}

function extractAlphaFromGrid(grid: ColourBlock[][]) {
  let targetAlpha = 0;
  let baseAlpha = 0;

  for (const row of grid) {
    for (const block of row) {
      const alpha = hextToAlpha(block.colour);
      if (block.isTarget && targetAlpha === 0) {
        targetAlpha = alpha;
      }
      if (!block.isTarget && baseAlpha === 0) {
        baseAlpha = alpha;
      }
      if (targetAlpha !== 0 && baseAlpha !== 0) {
        return { targetAlpha, baseAlpha };
      }
    }
  }

  return {
    targetAlpha,
    baseAlpha: baseAlpha || 255,
  };
}

function safeParseGrid(value: string | null): ColourBlock[][] | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return null;
    }

    const grid = parsed as ColourBlock[][];
    if (!grid.every((row) => Array.isArray(row))) {
      return null;
    }

    return grid;
  } catch (error) {
    console.warn("Unable to parse stored colour game state.", error);
    return null;
  }
}

function generateGame(size: number, level: number): GameGenerationResult {
  const normalizedSize = Math.max(1, Math.min(MAX_AMOUNT, Math.floor(size)));

  const baseColour = fullColorHex(
    Math.floor(Math.random() * 255),
    Math.floor(Math.random() * 255),
    Math.floor(Math.random() * 255),
    255,
  );

  const rightBlock: ColourBlock = {
    colour: baseColour.hex,
    isTarget: false,
  };

  const alphaOffset = getBiasedRandomAbovePercent(level);
  const targetColour = `#${baseColour.red}${baseColour.green}${baseColour.blue}${rgbToHex(alphaOffset)}`;

  const targetBlock: ColourBlock = {
    colour: targetColour,
    isTarget: true,
  };

  const targetIndex = Math.floor(
    Math.random() * normalizedSize * normalizedSize,
  );
  const grid: ColourBlock[][] = [];
  let currentIndex = 0;

  for (let rowIndex = 0; rowIndex < normalizedSize; rowIndex += 1) {
    const row: ColourBlock[] = [];
    for (let colIndex = 0; colIndex < normalizedSize; colIndex += 1) {
      if (currentIndex === targetIndex) {
        row.push(targetBlock);
      } else {
        row.push({ ...rightBlock });
      }
      currentIndex += 1;
    }
    grid.push(row);
  }

  return {
    grid,
    targetAlpha: hextToAlpha(targetBlock.colour),
    baseAlpha: hextToAlpha(rightBlock.colour),
  };
}

export default function ColourGame() {
  const initialGame = useMemo(
    () => generateGame(START_AMOUNT, START_LEVEL),
    [],
  );

  const [amount, setAmount] = useState<number>(START_AMOUNT);
  const [level, setLevel] = useState<number>(START_LEVEL);
  const [count, setCount] = useState<number>(0);
  const [grid, setGrid] = useState<ColourBlock[][]>(initialGame.grid);
  const [targetAlpha, setTargetAlpha] = useState<number>(
    initialGame.targetAlpha,
  );
  const [baseAlpha, setBaseAlpha] = useState<number>(initialGame.baseAlpha);
  const [hydrated, setHydrated] = useState(false);
  const [boardSize, setBoardSize] = useState<number>(640);
  const boardWrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const storedAmount = readNumberFromStorage(
      STORAGE_KEYS.amount,
      START_AMOUNT,
    );
    const storedLevel = readNumberFromStorage(STORAGE_KEYS.level, START_LEVEL);
    const storedCount = readNumberFromStorage(STORAGE_KEYS.count, 0);
    const storedGrid = safeParseGrid(
      window.localStorage.getItem(STORAGE_KEYS.state),
    );

    setAmount(storedAmount);
    setLevel(storedLevel);
    setCount(storedCount);

    if (storedGrid) {
      setGrid(storedGrid);
      const { targetAlpha: storedTargetAlpha, baseAlpha: storedBaseAlpha } =
        extractAlphaFromGrid(storedGrid);
      setTargetAlpha(storedTargetAlpha);
      setBaseAlpha(storedBaseAlpha);
    } else {
      const nextGame = generateGame(storedAmount, storedLevel);
      setGrid(nextGame.grid);
      setTargetAlpha(nextGame.targetAlpha);
      setBaseAlpha(nextGame.baseAlpha);
    }

    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(STORAGE_KEYS.amount, String(amount));
    window.localStorage.setItem(STORAGE_KEYS.level, String(level));
    window.localStorage.setItem(STORAGE_KEYS.count, String(count));
    window.localStorage.setItem(STORAGE_KEYS.state, JSON.stringify(grid));
  }, [amount, count, grid, hydrated, level]);

  const resetGame = useCallback(() => {
    const nextGame = generateGame(START_AMOUNT, START_LEVEL);

    setAmount(START_AMOUNT);
    setLevel(START_LEVEL);
    setCount(0);
    setGrid(nextGame.grid);
    setTargetAlpha(nextGame.targetAlpha);
    setBaseAlpha(nextGame.baseAlpha);
  }, []);

  const regenerateBoard = useCallback(() => {
    const nextGame = generateGame(amount, level);
    setGrid(nextGame.grid);
    setTargetAlpha(nextGame.targetAlpha);
    setBaseAlpha(nextGame.baseAlpha);
  }, [amount, level]);

  const handleGuess = useCallback(
    (isTarget: boolean) => {
      if (!isTarget) {
        resetGame();
        return;
      }

      const nextGame = generateGame(amount, level);
      setGrid(nextGame.grid);
      setTargetAlpha(nextGame.targetAlpha);
      setBaseAlpha(nextGame.baseAlpha);

      let completedThresholds = 0;
      let nextLevel = level;
      let nextAmount = amount;

      if (count % 2 === 0) {
        if (level < MAX_LEVEL) {
          nextLevel = Math.min(MAX_LEVEL, level + 5);
        } else {
          completedThresholds += 1;
        }
      } else if (amount < MAX_AMOUNT) {
        nextAmount = Math.min(MAX_AMOUNT, amount + 1);
      } else {
        completedThresholds += 1;
      }

      const nextCount = count + 1;

      if (completedThresholds === 2) {
        resetGame();
        return;
      }

      setLevel(nextLevel);
      setAmount(nextAmount);
      setCount(nextCount);
    },
    [amount, count, level, resetGame],
  );

  const difficultyPercent = useMemo(() => {
    if (!baseAlpha) {
      return 0;
    }
    const ratio = targetAlpha / baseAlpha;
    if (!Number.isFinite(ratio) || ratio <= 0) {
      return 0;
    }
    return Math.round(ratio * 10000) / 100;
  }, [baseAlpha, targetAlpha]);

  const alphaDifference = useMemo(() => {
    if (!Number.isFinite(targetAlpha) || !Number.isFinite(baseAlpha)) {
      return 0;
    }
    return Math.abs(baseAlpha - targetAlpha);
  }, [baseAlpha, targetAlpha]);

  const recalculateBoardSize = useCallback(() => {
    if (!boardWrapperRef.current || typeof window === "undefined") {
      return;
    }

    const wrapperWidth = boardWrapperRef.current.clientWidth;
    const rect = boardWrapperRef.current.getBoundingClientRect();
    const availableHeight = window.innerHeight - rect.top;

    const cappedWidth = Number.isFinite(wrapperWidth)
      ? Math.max(160, Math.min(wrapperWidth, 640))
      : 640;

    const cappedHeight =
      Number.isFinite(availableHeight) && availableHeight > 0
        ? Math.max(160, Math.min(availableHeight, 640))
        : cappedWidth;

    const nextSize = Math.min(cappedWidth, cappedHeight);
    setBoardSize(nextSize);
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    const handleResize = () => {
      window.requestAnimationFrame(recalculateBoardSize);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [hydrated, recalculateBoardSize]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    recalculateBoardSize();
  }, [amount, hydrated, recalculateBoardSize]);

  return (
    <div className="tools-shell flex max-w-5xl flex-col gap-6">
      <section className="tool-panel-lg">
        <div className="grid gap-6 md:grid-cols-[1.1fr_0.9fr] md:items-center">
          <div className="space-y-4">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Colour Contrast Trainer
            </h1>
            <p className="max-w-xl text-base leading-relaxed text-card-foreground">
              Spot the odd alpha channel. Each correct pick increases the
              opacity gap or expands the grid. Miss it and you&apos;re back to
              basics.
            </p>
          </div>

          <div className="tool-subpanel grid gap-4 text-sm text-card-foreground">
            <div className="flex items-center justify-between">
              <span className="tool-label">
                Level
              </span>
              <span className="text-lg font-semibold text-foreground">
                {level}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="tool-label">
                Grid size
              </span>
              <span className="text-lg font-semibold text-foreground">
                {amount} × {amount}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="tool-label">
                Streak
              </span>
              <span className="text-lg font-semibold text-foreground">
                {count}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-[1fr_320px]">
        <div
          ref={boardWrapperRef}
          className="tool-panel-lg flex flex-col gap-6"
        >
          <header className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">
              Find the different colour
            </h2>
            <p className="text-sm text-card-foreground">
              One tile has a lower alpha value. Select it to advance. The grid
              updates immediately after each guess.
            </p>
          </header>

          <div className="flex flex-col items-center gap-6">
            <div
              className="grid w-full"
              style={{
                gridTemplateColumns: `repeat(${amount}, minmax(0, 1fr))`,
                gridTemplateRows: `repeat(${amount}, minmax(0, 1fr))`,
                gap: 0,
                width: "100%",
                maxWidth: `${boardSize}px`,
                maxHeight: `${boardSize}px`,
                aspectRatio: "1 / 1",
              }}
              role="group"
              aria-label="Colour grid"
            >
              {grid.map((row, rowIndex) =>
                row.map((block, columnIndex) => (
                  <button
                    key={`${rowIndex}-${columnIndex}`}
                    type="button"
                    data-key={`${rowIndex}-${columnIndex}`}
                    onClick={() => handleGuess(block.isTarget)}
                    style={{ backgroundColor: block.colour }}
                    className="block h-full w-full focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                    aria-label={
                      block.isTarget
                        ? "Potential target colour"
                        : "Regular colour"
                    }
                  />
                )),
              )}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={regenerateBoard}
                className="tool-button-secondary"
              >
                Regenerate board
              </button>
              <button
                type="button"
                onClick={resetGame}
                className="tool-button-danger"
              >
                Reset progress
              </button>
            </div>
          </div>
        </div>

        <aside className="tool-panel-lg flex flex-col gap-4 text-card-foreground">
          <h3 className="text-base font-semibold text-foreground">
            Difficulty snapshot
          </h3>
          <p className="text-sm">
            Difficulty adjusts by increasing opacity contrast and grid density.
            Keep the streak going to push both limits.
          </p>

          <div className="grid gap-4">
            <div className="tool-subpanel">
              <span className="tool-label">
                Target alpha
              </span>
              <p className="mt-2 text-2xl font-semibold text-foreground">
                {targetAlpha}
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  / 255
                </span>
              </p>
            </div>

            <div className="tool-subpanel">
              <span className="tool-label">
                Base alpha
              </span>
              <p className="mt-2 text-2xl font-semibold text-foreground">
                {baseAlpha}
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  / 255
                </span>
              </p>
            </div>

            <div className="tool-subpanel border-primary/30 bg-card">
              <span className="tool-label">
                Contrast ratio
              </span>
              <p className="mt-2 text-2xl font-semibold text-foreground">
                {difficultyPercent}%
              </p>
              <p className="mt-1 text-sm text-card-foreground">
                {(difficultyPercent / 100).toFixed(3)} relative opacity
              </p>
            </div>

            <div className="tool-subpanel border-emerald-500/40 bg-card">
              <span className="tool-label">
                Alpha difference
              </span>
              <p className="mt-2 text-2xl font-semibold text-foreground">
                {alphaDifference}
              </p>
              <p className="mt-1 text-sm text-card-foreground">
                Lower numbers mean a harder distinction.
              </p>
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
