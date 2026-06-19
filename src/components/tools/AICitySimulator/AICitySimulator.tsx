import {
  AlertTriangle,
  Pause,
  Play,
  RotateCcw,
  ShieldAlert,
} from "lucide-react";
import { useEffect, useId, useState } from "react";

import {
  AI_CITY_SIMULATOR_STORAGE_KEY,
  type EconomySnapshot,
  type MapNodeKey,
  type SimulatorState,
  SIMULATION_BASELINES,
  SIMULATION_SPEEDS,
  SIMULATION_SPEED_INTERVALS,
  createInitialSimulatorState,
  getCollapseWarnings,
  getEconomySnapshot,
  getSpeedLabel,
  getStabilityTone,
  isPersistedSimulatorState,
  simulateMonth,
} from "./simulation";

type MetricCardProps = {
  label: string;
  value: string;
  detail: string;
  tone?: "stable" | "warning" | "critical";
  meter?: number;
};

type FlowPathProps = {
  amount: number;
  color: string;
  delay?: number;
  duration?: number;
  maxAmount: number;
  path: string;
};

type MapNodeConfig = {
  key: MapNodeKey;
  label: string;
  caption: string;
  shape: "rect" | "pill" | "circle";
  x: number;
  y: number;
  width?: number;
  height?: number;
  radius?: number;
};

type MapNodeProps = {
  config: MapNodeConfig;
  selected: boolean;
  snapshot: EconomySnapshot;
  onSelect: (key: MapNodeKey) => void;
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

const numberFormatter = new Intl.NumberFormat("en-US");

const percentFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

const MAP_NODES: MapNodeConfig[] = [
  {
    key: "outsideClients",
    label: "Outside Clients",
    caption: "External demand",
    shape: "rect",
    x: 48,
    y: 70,
    width: 176,
    height: 92,
  },
  {
    key: "whiteCollar",
    label: "White Collar Workers",
    caption: "50% of city jobs",
    shape: "rect",
    x: 270,
    y: 76,
    width: 344,
    height: 186,
  },
  {
    key: "cityHall",
    label: "City Hall",
    caption: "Taxes and support",
    shape: "rect",
    x: 766,
    y: 82,
    width: 176,
    height: 96,
  },
  {
    key: "schoolClinic",
    label: "School / Clinic",
    caption: "Public services",
    shape: "rect",
    x: 748,
    y: 246,
    width: 194,
    height: 108,
  },
  {
    key: "retail",
    label: "Retail",
    caption: "Shops and goods",
    shape: "pill",
    x: 72,
    y: 326,
    width: 176,
    height: 98,
  },
  {
    key: "households",
    label: "Households",
    caption: "Workers and demand",
    shape: "pill",
    x: 260,
    y: 372,
    width: 308,
    height: 120,
  },
  {
    key: "food",
    label: "Food",
    caption: "Cafes and groceries",
    shape: "pill",
    x: 86,
    y: 476,
    width: 162,
    height: 84,
  },
  {
    key: "housing",
    label: "Housing",
    caption: "Rent and upkeep",
    shape: "pill",
    x: 586,
    y: 434,
    width: 196,
    height: 102,
  },
];

const AI_ADOPTION_PRESETS = [0, 0.25, 0.5, 0.75, 1] as const;

const FLOW_PATHS = {
  externalRevenue: "M 224 116 C 250 118, 270 130, 286 142",
  wages: "M 438 262 C 436 304, 406 344, 376 372",
  retailSpending: "M 264 420 C 220 404, 196 392, 168 378",
  foodSpending: "M 264 456 C 224 474, 198 492, 170 512",
  housingSpending: "M 564 444 C 590 446, 618 458, 648 474",
  whiteTaxes: "M 614 154 C 664 154, 716 146, 766 130",
  retailTaxes: "M 248 356 C 470 324, 622 228, 766 136",
  foodTaxes: "M 248 516 C 450 420, 620 258, 766 148",
  housingTaxes: "M 782 476 C 812 398, 820 286, 840 176",
  services: "M 854 178 C 854 204, 850 224, 848 246",
  support: "M 766 146 C 676 222, 592 308, 524 386",
} as const;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

function formatInteger(value: number) {
  return numberFormatter.format(Math.round(value));
}

function formatPercent(value: number) {
  return `${percentFormatter.format(value)}%`;
}

function formatSupportCoverage(snapshot: EconomySnapshot) {
  if (snapshot.unemploymentSupportNeed === 0) {
    return "Not needed";
  }

  return formatPercent(snapshot.supportCoverage * 100);
}

function formatDeltaCurrency(value: number) {
  const formatted = formatCurrency(Math.abs(value));
  if (value > 0) {
    return `+${formatted}`;
  }
  if (value < 0) {
    return `-${formatted}`;
  }

  return formatted;
}

function getNodeMetricLines(key: MapNodeKey, snapshot: EconomySnapshot) {
  switch (key) {
    case "whiteCollar":
      return [
        `${formatInteger(snapshot.whiteCollarWorkers)} employed`,
        `${formatCurrency(snapshot.whiteCollarProfit)} profit`,
      ];
    case "households":
      return [
        `${formatCurrency(snapshot.householdIncome)} income`,
        `${formatPercent(snapshot.unemploymentRate)} unemployed`,
      ];
    case "retail":
      return [
        `${formatInteger(snapshot.sectorWorkers.retail)} jobs`,
        `${formatCurrency(snapshot.sectorRevenue.retail)} spend`,
      ];
    case "food":
      return [
        `${formatInteger(snapshot.sectorWorkers.food)} jobs`,
        `${formatCurrency(snapshot.sectorRevenue.food)} spend`,
      ];
    case "housing":
      return [
        `${formatInteger(snapshot.sectorWorkers.housing)} jobs`,
        `${formatCurrency(snapshot.sectorRevenue.housing)} spend`,
      ];
    case "cityHall":
      return [
        `${formatCurrency(snapshot.cityBudget)} reserve`,
        `${formatDeltaCurrency(snapshot.fiscalBalance)} monthly balance`,
      ];
    case "schoolClinic":
      return [
        `${formatInteger(snapshot.sectorWorkers.schoolClinic)} staff`,
        `${formatPercent(snapshot.publicServiceLevel * 100)} service level`,
      ];
    case "outsideClients":
      return [
        `${formatCurrency(snapshot.outsideRevenue)} inbound`,
        `${formatPercent(snapshot.aiAdoption * 100)} AI adoption`,
      ];
  }
}

function getNodeDetail(key: MapNodeKey, snapshot: EconomySnapshot) {
  switch (key) {
    case "whiteCollar":
      return {
        eyebrow: "Primary shock point",
        title: "White Collar Workers",
        description:
          "This district drives half the city's jobs. AI lifts output per worker and profits first, then sheds payroll in waves as adoption ramps in. Some of the displaced are slowly reabsorbed into new AI-era roles.",
        stats: [
          {
            label: "Workers",
            value: `${formatInteger(snapshot.whiteCollarWorkers)} / ${formatInteger(SIMULATION_BASELINES.whiteCollarWorkers)}`,
          },
          {
            label: "Revenue",
            value: formatCurrency(snapshot.whiteCollarRevenue),
          },
          {
            label: "Payroll",
            value: formatCurrency(snapshot.whiteCollarPayroll),
          },
          {
            label: "Avg wage",
            value: formatCurrency(snapshot.whiteCollarWage),
          },
          {
            label: "AI leakage",
            value: formatCurrency(snapshot.aiLeakageCost),
          },
          {
            label: "New AI-era roles",
            value: formatInteger(snapshot.newRoleWorkers),
          },
        ],
      };
    case "households":
      return {
        eyebrow: "Demand engine",
        title: "Households",
        description:
          "Households absorb layoffs and wage erosion first. The longer people stay unemployed, the harder they are to re-hire — and eventually some leave the city for good.",
        stats: [
          {
            label: "Income",
            value: formatCurrency(snapshot.householdIncome),
          },
          {
            label: "Spending",
            value: formatCurrency(snapshot.householdSpending),
          },
          {
            label: "Unemployment",
            value: formatPercent(snapshot.unemploymentRate),
          },
          {
            label: "Long-term unemployed",
            value: formatInteger(snapshot.longTermUnemployed),
          },
          {
            label: "Confidence",
            value: formatPercent(snapshot.consumerConfidence * 100),
          },
          {
            label: "Demand next month",
            value: formatPercent(snapshot.projectedNextDemand),
          },
        ],
      };
    case "retail":
      return {
        eyebrow: "Consumer spending",
        title: "Retail",
        description:
          "Retail responds quickly when household wallets tighten, so it is one of the first secondary sectors to wobble after layoffs.",
        stats: [
          {
            label: "Workers",
            value: formatInteger(snapshot.sectorWorkers.retail),
          },
          {
            label: "Revenue",
            value: formatCurrency(snapshot.sectorRevenue.retail),
          },
        ],
      };
    case "food":
      return {
        eyebrow: "Everyday essentials",
        title: "Food",
        description:
          "Food is a little more resilient than retail, but it still declines when wage income and foot traffic fall.",
        stats: [
          {
            label: "Workers",
            value: formatInteger(snapshot.sectorWorkers.food),
          },
          {
            label: "Revenue",
            value: formatCurrency(snapshot.sectorRevenue.food),
          },
        ],
      };
    case "housing":
      return {
        eyebrow: "Sticky commitments",
        title: "Housing",
        description:
          "Housing moves more slowly than discretionary spending, but prolonged demand weakness eventually shows up here too.",
        stats: [
          {
            label: "Workers",
            value: formatInteger(snapshot.sectorWorkers.housing),
          },
          {
            label: "Revenue",
            value: formatCurrency(snapshot.sectorRevenue.housing),
          },
        ],
      };
    case "cityHall":
      return {
        eyebrow: "Fiscal buffer",
        title: "City Hall",
        description:
          "Tax receipts rise with profits, but unemployment support and service costs can outrun them if layoffs spread too far. Running a deficit adds interest costs on top.",
        stats: [
          {
            label: "Budget",
            value: formatCurrency(snapshot.cityBudget),
          },
          {
            label: "Taxes",
            value: formatCurrency(snapshot.taxRevenue),
          },
          {
            label: "Monthly balance",
            value: formatDeltaCurrency(snapshot.fiscalBalance),
          },
          {
            label: "Support paid",
            value: formatCurrency(snapshot.unemploymentSupport),
          },
          {
            label: "Support coverage",
            value: formatSupportCoverage(snapshot),
          },
          {
            label: "Debt interest",
            value: formatCurrency(snapshot.debtInterest),
          },
        ],
      };
    case "schoolClinic":
      return {
        eyebrow: "Shared services",
        title: "School / Clinic",
        description:
          "Public services stabilize the city, but they depend on city hall keeping enough room in the budget to pay for them.",
        stats: [
          {
            label: "Staff",
            value: formatInteger(snapshot.sectorWorkers.schoolClinic),
          },
          {
            label: "Service spend",
            value: formatCurrency(snapshot.publicServiceCost),
          },
          {
            label: "Service level",
            value: formatPercent(snapshot.publicServiceLevel * 100),
          },
        ],
      };
    case "outsideClients":
      return {
        eyebrow: "External demand",
        title: "Outside Clients",
        description:
          "Outside clients keep revenue flowing into White Collar Workers. That cushions profits even while money leaks back out through AI spend.",
        stats: [
          {
            label: "Revenue in",
            value: formatCurrency(snapshot.outsideRevenue),
          },
          {
            label: "Adoption",
            value: formatPercent(snapshot.aiAdoption * 100),
          },
        ],
      };
  }
}

function getNarrative(snapshot: EconomySnapshot) {
  if (snapshot.collapseRisk.stability) {
    return "The city is now in overt decline. Demand is shrinking, the safety net is thinning, and public capacity is starting to fail.";
  }

  if (snapshot.collapseRisk.exodus) {
    return "The exodus has started. Long-term unemployed residents are leaving, and each departure permanently shrinks local demand and the tax base.";
  }

  if (snapshot.collapseRisk.services || snapshot.collapseRisk.support) {
    return "The fiscal buffer is buckling. Displaced workers are losing support at the same time schools, clinics, and city operations are being trimmed.";
  }

  if (snapshot.collapseRisk.unemployment) {
    return "Automation is outrunning reabsorption. White-collar profits may still look healthy, but the rest of the city is starting to hollow out.";
  }

  if (snapshot.longTermShare > 0.55 && snapshot.unemploymentRate > 9) {
    return "Unemployment is hardening. More than half of the jobless have been out of work over six months, which makes every recovery slower.";
  }

  if (snapshot.aiAdoptionTarget > snapshot.aiAdoption + 0.05) {
    return "Firms are still rolling AI out toward the target. The labor market impact arrives in waves over the coming months, not all at once.";
  }

  if (snapshot.aiAdoption >= 0.5 && snapshot.cityBudget < 250_000) {
    return "AI gains are visible, but city hall is running down its reserves to slow the damage to households and public services.";
  }

  if (snapshot.aiAdoption > 0.2) {
    return "The city is still functioning, but each month more of the AI upside is bypassing local payroll and leaving a smaller tax base behind.";
  }

  return "The starting city is close to balance. Wages, local spending, taxes, and public services are mostly reinforcing one another.";
}

function FlowPath({
  amount,
  color,
  delay = 0,
  duration = 5.2,
  maxAmount,
  path,
}: FlowPathProps) {
  const ratio = maxAmount === 0 ? 0 : clamp(amount / maxAmount, 0, 1);
  const strokeWidth = 2 + ratio * 8;
  const opacity = 0.18 + ratio * 0.54;

  return (
    <g>
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeOpacity={opacity}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray="8 10"
      />
      {amount > 0 && (
        <>
          <circle r={4 + ratio * 3} fill={color} opacity={0.92}>
            <animateMotion
              dur={`${duration}s`}
              begin={`${delay}s`}
              repeatCount="indefinite"
              path={path}
            />
          </circle>
          <circle r={2.5 + ratio * 2} fill={color} opacity={0.62}>
            <animateMotion
              dur={`${duration * 1.16}s`}
              begin={`${delay + duration / 2}s`}
              repeatCount="indefinite"
              path={path}
            />
          </circle>
        </>
      )}
    </g>
  );
}

function MetricCard({
  label,
  value,
  detail,
  tone = "stable",
  meter = 0.5,
}: MetricCardProps) {
  const barColor =
    tone === "critical"
      ? "oklch(0.66 0.18 28)"
      : tone === "warning"
        ? "oklch(0.76 0.15 82)"
        : "oklch(0.63 0.11 188)";

  return (
    <div
      className="rounded-[1.15rem] border px-4 py-4"
      style={{
        borderColor: "color-mix(in oklch, var(--tool-accent) 18%, hsl(var(--border)) 82%)",
        background:
          "linear-gradient(180deg, color-mix(in oklch, hsl(var(--card)) 94%, var(--tool-accent) 6%) 0%, color-mix(in oklch, hsl(var(--card)) 97%, oklch(0.98 0.004 190) 3%) 100%)",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          {label}
        </p>
        <span
          className="mt-1 h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: barColor }}
          aria-hidden="true"
        />
      </div>
      <div className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
        {value}
      </div>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">{detail}</p>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted/80">
        <div
          className="h-full rounded-full transition-[width] duration-200 ease-out"
          style={{
            width: `${clamp(meter, 0, 1) * 100}%`,
            backgroundColor: barColor,
          }}
        />
      </div>
    </div>
  );
}

function MapNode({ config, selected, snapshot, onSelect }: MapNodeProps) {
  const metricLines = getNodeMetricLines(config.key, snapshot);
  const accentFill =
    config.key === "whiteCollar"
      ? "oklch(0.72 0.09 185)"
      : config.key === "cityHall" || config.key === "schoolClinic"
        ? "oklch(0.8 0.03 210)"
        : config.key === "outsideClients"
          ? "oklch(0.83 0.05 200)"
          : "oklch(0.87 0.028 190)";

  const borderColor =
    config.key === "whiteCollar"
      ? "oklch(0.55 0.09 185)"
      : selected
        ? "oklch(0.56 0.09 196)"
        : "oklch(0.73 0.03 205)";
  const textColor =
    config.key === "whiteCollar" ? "oklch(0.22 0.03 196)" : "oklch(0.28 0.02 205)";

  const handleSelect = () => onSelect(config.key);

  return (
    <g
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={handleSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handleSelect();
        }
      }}
      style={{ cursor: "pointer" }}
    >
      {config.shape === "circle" ? (
        <circle
          cx={config.x}
          cy={config.y}
          r={config.radius}
          fill={accentFill}
          stroke={borderColor}
          strokeWidth={selected ? 4 : 2}
        />
      ) : (
        <rect
          x={config.x}
          y={config.y}
          width={config.width}
          height={config.height}
          rx={config.shape === "pill" ? 28 : 22}
          fill={accentFill}
          stroke={borderColor}
          strokeWidth={selected ? 4 : 2}
        />
      )}

      {selected && config.shape !== "circle" && (
        <rect
          x={(config.x ?? 0) - 8}
          y={(config.y ?? 0) - 8}
          width={(config.width ?? 0) + 16}
          height={(config.height ?? 0) + 16}
          rx={config.shape === "pill" ? 34 : 28}
          fill="none"
          stroke="oklch(0.62 0.08 188 / 0.32)"
          strokeWidth={4}
          strokeDasharray="10 10"
        />
      )}

      <text
        x={(config.width ? config.x + config.width / 2 : config.x)}
        y={
          config.shape === "circle"
            ? config.y - 16
            : config.y + (config.key === "whiteCollar" ? 48 : 34)
        }
        textAnchor="middle"
        fill={textColor}
        fontSize={config.key === "whiteCollar" ? 24 : 18}
        fontWeight={700}
      >
        {config.label}
      </text>

      <text
        x={(config.width ? config.x + config.width / 2 : config.x)}
        y={
          config.shape === "circle"
            ? config.y + 6
            : config.y + (config.key === "whiteCollar" ? 78 : 58)
        }
        textAnchor="middle"
        fill="oklch(0.39 0.02 204)"
        fontSize={13}
        fontWeight={600}
        letterSpacing="0.08em"
      >
        {config.caption.toUpperCase()}
      </text>

      {metricLines.map((line, index) => (
        <text
          key={`${config.key}-${line}`}
          x={(config.width ? config.x + config.width / 2 : config.x)}
          y={
            config.shape === "circle"
              ? config.y + 32 + index * 22
              : config.y +
                (config.key === "whiteCollar" ? 118 : 86) +
                index * 20
          }
          textAnchor="middle"
          fill="oklch(0.3 0.02 204)"
          fontSize={14}
        >
          {line}
        </text>
      ))}
    </g>
  );
}

function readStoredState() {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(AI_CITY_SIMULATOR_STORAGE_KEY);

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isPersistedSimulatorState(parsed)) {
      return null;
    }

    return {
      ...parsed,
      isPlaying: false,
    };
  } catch (error) {
    console.warn("Unable to read AI City Simulator state.", error);
    return null;
  }
}

export default function AICitySimulator() {
  const [state, setState] = useState<SimulatorState>(createInitialSimulatorState);
  const [hydrated, setHydrated] = useState(false);
  const gradientId = useId().replace(/:/g, "");

  useEffect(() => {
    const storedState = readStoredState();

    if (storedState) {
      setState(storedState);
    }

    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(
      AI_CITY_SIMULATOR_STORAGE_KEY,
      JSON.stringify(state),
    );
  }, [hydrated, state]);

  useEffect(() => {
    if (!hydrated || !state.isPlaying) {
      return;
    }

    const interval = window.setInterval(() => {
      setState((current) => simulateMonth(current));
    }, SIMULATION_SPEED_INTERVALS[state.speed]);

    return () => window.clearInterval(interval);
  }, [hydrated, state.isPlaying, state.speed]);

  const snapshot = getEconomySnapshot(state);
  const selectedNode = getNodeDetail(state.selectedNode, snapshot);
  const warnings = getCollapseWarnings(snapshot);
  const stabilityTone = getStabilityTone(snapshot.stability);
  const aiAdoptionTargetPercent = Math.round(state.aiAdoptionTarget * 100);
  const aiAtMinimum = aiAdoptionTargetPercent <= 0;
  const aiAtMaximum = aiAdoptionTargetPercent >= 100;
  const maxFlowAmount = Math.max(
    snapshot.outsideRevenue,
    snapshot.whiteCollarPayroll,
    snapshot.sectorRevenue.retail,
    snapshot.sectorRevenue.food,
    snapshot.sectorRevenue.housing,
    snapshot.taxRevenue,
    snapshot.publicServiceCost,
    snapshot.unemploymentSupport,
  );

  const resetState = () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(AI_CITY_SIMULATOR_STORAGE_KEY);
    }
    setState(createInitialSimulatorState());
  };

  const setAiAdoptionTarget = (nextValue: number) => {
    setState((current) => ({
      ...current,
      aiAdoptionTarget: clamp(nextValue, 0, 1),
    }));
  };

  return (
    <div className="tools-shell-wide flex flex-col gap-6">
      <section className="tool-panel-lg overflow-hidden">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-3">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-[color:var(--tool-accent-text)]">
              Municipal Dashboard Prototype
            </p>
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-[2.55rem]">
                AI City Simulator
              </h1>
              <p className="max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
                Set an AI adoption target for the white-collar sector and watch
                the shock ripple through a 1,000-worker city over months:
                gradual rollout, capped layoff waves, long-term unemployment,
                wage erosion, new AI-era jobs, strained budgets, and eventually
                out-migration. Scale the city up mentally to a region or
                country — the relative dynamics stay the same.
              </p>
            </div>
          </div>

          <div
            className="rounded-[1.3rem] border px-4 py-4 sm:px-5"
            style={{
              borderColor:
                "color-mix(in oklch, var(--tool-accent) 28%, hsl(var(--border)) 72%)",
              background:
                "linear-gradient(135deg, color-mix(in oklch, var(--tool-accent) 12%, hsl(var(--card)) 88%) 0%, color-mix(in oklch, oklch(0.97 0.004 190) 76%, var(--tool-accent) 24%) 100%)",
            }}
          >
            <div className="flex items-center gap-3">
              {warnings.length > 0 ? (
                <ShieldAlert className="h-5 w-5 text-[color:var(--tool-accent-text)]" />
              ) : (
                <div
                  className="h-3 w-3 rounded-full"
                  style={{
                    backgroundColor:
                      stabilityTone === "stable"
                        ? "oklch(0.65 0.12 170)"
                        : stabilityTone === "warning"
                          ? "oklch(0.78 0.16 82)"
                          : "oklch(0.65 0.19 28)",
                  }}
                  aria-hidden="true"
                />
              )}
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {state.isPlaying ? "Simulation running" : "Simulation paused"}
                </p>
                <p className="text-sm text-muted-foreground">
                  Month {snapshot.month}, stability{" "}
                  {formatPercent(snapshot.stability)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {warnings.length > 0 && (
        <section
          className="rounded-[1.4rem] border px-5 py-4"
          style={{
            borderColor: "oklch(0.78 0.11 80 / 0.65)",
            background:
              "linear-gradient(180deg, oklch(0.96 0.03 85) 0%, oklch(0.985 0.012 90) 100%)",
          }}
        >
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="flex gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
              <div className="space-y-1">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-900">
                  Collapse Warning
                </p>
                <div className="space-y-1">
                  {warnings.map((warning) => (
                    <p
                      key={warning}
                      className="text-sm leading-6 text-amber-950/85"
                    >
                      {warning}
                    </p>
                  ))}
                </div>
              </div>
            </div>
            <p className="max-w-md text-sm leading-6 text-amber-950/75">
              {getNarrative(snapshot)}
            </p>
          </div>
        </section>
      )}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(20rem,0.9fr)]">
        <div className="tool-panel-lg space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                City map
              </h2>
              <p className="text-sm leading-6 text-muted-foreground">
                Click a district to inspect its role in the local feedback loop.
                White Collar Workers starts with{" "}
                {formatInteger(SIMULATION_BASELINES.whiteCollarWorkers)} /{" "}
                {formatInteger(SIMULATION_BASELINES.totalWorkforce)} jobs.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs font-medium text-muted-foreground">
              <span className="rounded-full bg-muted px-3 py-1.5">
                Demand {formatPercent(snapshot.demand)}
              </span>
              <span className="rounded-full bg-muted px-3 py-1.5">
                Next month {formatPercent(snapshot.projectedNextDemand)}
              </span>
            </div>
          </div>

          <div
            className="overflow-hidden rounded-[1.45rem] border p-3"
            style={{
              borderColor:
                "color-mix(in oklch, var(--tool-accent) 24%, hsl(var(--border)) 76%)",
              background:
                "linear-gradient(180deg, oklch(0.985 0.006 190) 0%, oklch(0.96 0.012 192) 100%)",
            }}
          >
            <svg
              viewBox="0 0 1000 620"
              className="h-full w-full"
              aria-label="Interactive city economy map"
            >
              <defs>
                <linearGradient
                  id={`city-grid-${gradientId}`}
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="100%"
                >
                  <stop offset="0%" stopColor="oklch(0.95 0.015 190)" />
                  <stop offset="100%" stopColor="oklch(0.92 0.02 195)" />
                </linearGradient>
              </defs>

              <rect
                x="12"
                y="12"
                width="976"
                height="596"
                rx="28"
                fill={`url(#city-grid-${gradientId})`}
              />
              <g opacity="0.32">
                {Array.from({ length: 9 }).map((_, index) => (
                  <line
                    key={`h-${index}`}
                    x1="40"
                    x2="960"
                    y1={60 + index * 60}
                    y2={60 + index * 60}
                    stroke="oklch(0.77 0.02 198)"
                    strokeWidth="1"
                  />
                ))}
                {Array.from({ length: 10 }).map((_, index) => (
                  <line
                    key={`v-${index}`}
                    y1="40"
                    y2="580"
                    x1={68 + index * 92}
                    x2={68 + index * 92}
                    stroke="oklch(0.77 0.02 198)"
                    strokeWidth="1"
                  />
                ))}
              </g>

              <FlowPath
                amount={snapshot.outsideRevenue}
                color="oklch(0.56 0.08 202)"
                maxAmount={maxFlowAmount}
                path={FLOW_PATHS.externalRevenue}
                duration={4.6}
              />
              <FlowPath
                amount={snapshot.whiteCollarPayroll}
                color="oklch(0.6 0.1 168)"
                maxAmount={maxFlowAmount}
                path={FLOW_PATHS.wages}
                duration={4.2}
                delay={0.5}
              />
              <FlowPath
                amount={snapshot.sectorRevenue.retail}
                color="oklch(0.73 0.1 78)"
                maxAmount={maxFlowAmount}
                path={FLOW_PATHS.retailSpending}
                duration={5.4}
                delay={0.3}
              />
              <FlowPath
                amount={snapshot.sectorRevenue.food}
                color="oklch(0.7 0.11 55)"
                maxAmount={maxFlowAmount}
                path={FLOW_PATHS.foodSpending}
                duration={5.7}
                delay={0.8}
              />
              <FlowPath
                amount={snapshot.sectorRevenue.housing}
                color="oklch(0.65 0.07 145)"
                maxAmount={maxFlowAmount}
                path={FLOW_PATHS.housingSpending}
                duration={5.1}
                delay={0.2}
              />
              <FlowPath
                amount={snapshot.taxRevenue * 0.42}
                color="oklch(0.55 0.08 216)"
                maxAmount={maxFlowAmount}
                path={FLOW_PATHS.whiteTaxes}
                duration={4.7}
              />
              <FlowPath
                amount={snapshot.taxRevenue * 0.22}
                color="oklch(0.55 0.08 216)"
                maxAmount={maxFlowAmount}
                path={FLOW_PATHS.retailTaxes}
                duration={6.2}
                delay={0.4}
              />
              <FlowPath
                amount={snapshot.taxRevenue * 0.14}
                color="oklch(0.55 0.08 216)"
                maxAmount={maxFlowAmount}
                path={FLOW_PATHS.foodTaxes}
                duration={6.5}
                delay={0.9}
              />
              <FlowPath
                amount={snapshot.taxRevenue * 0.22}
                color="oklch(0.55 0.08 216)"
                maxAmount={maxFlowAmount}
                path={FLOW_PATHS.housingTaxes}
                duration={5.8}
                delay={0.7}
              />
              <FlowPath
                amount={snapshot.publicServiceCost}
                color="oklch(0.68 0.05 196)"
                maxAmount={maxFlowAmount}
                path={FLOW_PATHS.services}
                duration={3.9}
              />
              <FlowPath
                amount={snapshot.unemploymentSupport}
                color="oklch(0.75 0.08 110)"
                maxAmount={maxFlowAmount}
                path={FLOW_PATHS.support}
                duration={5}
                delay={0.6}
              />

              {MAP_NODES.map((node) => (
                <MapNode
                  key={node.key}
                  config={node}
                  selected={state.selectedNode === node.key}
                  snapshot={snapshot}
                  onSelect={(key) =>
                    setState((current) => ({ ...current, selectedNode: key }))
                  }
                />
              ))}
            </svg>
          </div>

          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span className="rounded-full bg-muted px-3 py-1.5">
              Blue: taxes and outside revenue
            </span>
            <span className="rounded-full bg-muted px-3 py-1.5">
              Green: wages and household support
            </span>
            <span className="rounded-full bg-muted px-3 py-1.5">
              Gold: local spending
            </span>
          </div>
        </div>

        <div className="space-y-6">
          <section className="tool-panel-lg space-y-5">
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-foreground">
                Controls
              </h2>
              <p className="text-sm leading-6 text-muted-foreground">
                The simulator starts paused so you can inspect the baseline city
                before introducing automation pressure.
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-4">
                <label
                  htmlFor="ai-adoption"
                  className="text-sm font-medium text-foreground"
                >
                  AI adoption target at White Collar Workers
                </label>
                <span className="rounded-full bg-muted px-3 py-1 text-sm font-semibold text-foreground">
                  {formatPercent(snapshot.aiAdoption * 100)} →{" "}
                  {formatPercent(state.aiAdoptionTarget * 100)}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setAiAdoptionTarget(state.aiAdoptionTarget - 0.05)
                  }
                  disabled={aiAtMinimum}
                  className="tool-button-secondary"
                  aria-label="Decrease AI adoption target by 5 percent"
                >
                  -5%
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setAiAdoptionTarget(state.aiAdoptionTarget + 0.05)
                  }
                  disabled={aiAtMaximum}
                  className="tool-button-secondary"
                  aria-label="Increase AI adoption target by 5 percent"
                >
                  +5%
                </button>
                {AI_ADOPTION_PRESETS.map((preset) => {
                  const presetPercent = Math.round(preset * 100);
                  const active = aiAdoptionTargetPercent === presetPercent;

                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setAiAdoptionTarget(preset)}
                      aria-pressed={active}
                      className={active ? "tool-button" : "tool-button-secondary"}
                      aria-label={`Set AI adoption target to ${presetPercent} percent`}
                    >
                      {presetPercent}%
                    </button>
                  );
                })}
              </div>
              <input
                id="ai-adoption"
                type="range"
                min="0"
                max="100"
                value={aiAdoptionTargetPercent}
                onChange={(event) => {
                  setAiAdoptionTarget(Number(event.target.value) / 100);
                }}
                className="h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-[color:var(--tool-accent)]"
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  Firms roll AI out gradually — actual adoption follows the
                  target over months
                </span>
                <span>0% to 100%</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() =>
                  setState((current) => ({
                    ...current,
                    isPlaying: !current.isPlaying,
                  }))
                }
                className="tool-button"
              >
                {state.isPlaying ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                {state.isPlaying ? "Pause" : "Play"}
              </button>
              <button
                type="button"
                onClick={resetState}
                className="tool-button-secondary"
              >
                <RotateCcw className="h-4 w-4" />
                Reset scenario
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground">
                Simulation speed
              </p>
              <div className="flex flex-wrap gap-2">
                {SIMULATION_SPEEDS.map((speed) => {
                  const active = state.speed === speed;

                  return (
                    <button
                      key={speed}
                      type="button"
                      aria-pressed={active}
                      onClick={() =>
                        setState((current) => ({ ...current, speed }))
                      }
                      className={active ? "tool-button" : "tool-button-secondary"}
                    >
                      {getSpeedLabel(speed)}
                    </button>
                  );
                })}
              </div>
            </div>

            <div
              className="rounded-[1.15rem] border px-4 py-4"
              style={{
                borderColor:
                  "color-mix(in oklch, var(--tool-accent) 18%, hsl(var(--border)) 82%)",
                backgroundColor:
                  "color-mix(in oklch, hsl(var(--card)) 90%, var(--tool-accent) 10%)",
              }}
            >
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-[color:var(--tool-accent-text)]">
                Immediate read
              </p>
              <p className="mt-2 text-base font-semibold text-foreground">
                {snapshot.whiteCollarWorkers >=
                SIMULATION_BASELINES.whiteCollarWorkers
                  ? "The starting equilibrium is intact."
                  : snapshot.newRoleWorkers > 0
                    ? "White Collar Workers is shedding payroll, but new AI-era roles are reabsorbing part of the shock."
                    : "White Collar Workers is already shedding payroll."}
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {getNarrative(snapshot)}
              </p>
            </div>
          </section>

          <section className="tool-panel-lg space-y-4">
            <div>
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-[color:var(--tool-accent-text)]">
                Selected node
              </p>
              <h2 className="mt-2 text-lg font-semibold text-foreground">
                {selectedNode.title}
              </h2>
              <p className="mt-1 text-sm font-medium text-muted-foreground">
                {selectedNode.eyebrow}
              </p>
            </div>
            <p className="text-sm leading-6 text-muted-foreground">
              {selectedNode.description}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {selectedNode.stats.map((stat) => (
                <div
                  key={`${state.selectedNode}-${stat.label}`}
                  className="rounded-[1rem] border px-4 py-3"
                  style={{
                    borderColor:
                      "color-mix(in oklch, var(--tool-accent) 14%, hsl(var(--border)) 86%)",
                    backgroundColor:
                      "color-mix(in oklch, hsl(var(--card)) 95%, var(--tool-accent) 5%)",
                  }}
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    {stat.label}
                  </p>
                  <p className="mt-2 text-lg font-semibold text-foreground">
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Month"
          value={formatInteger(snapshot.month)}
          detail={
            state.isPlaying
              ? `Advancing at ${getSpeedLabel(state.speed)}`
              : "Paused at the current city snapshot"
          }
          meter={Math.min(snapshot.month / 24, 1)}
        />
        <MetricCard
          label="AI Adoption"
          value={formatPercent(snapshot.aiAdoption * 100)}
          detail={
            snapshot.aiAdoptionTarget > snapshot.aiAdoption + 0.005
              ? `Rolling out toward the ${formatPercent(snapshot.aiAdoptionTarget * 100)} target`
              : snapshot.aiAdoptionTarget < snapshot.aiAdoption - 0.005
                ? `Slowly unwinding toward the ${formatPercent(snapshot.aiAdoptionTarget * 100)} target`
                : "Adoption has reached the current target"
          }
          meter={snapshot.aiAdoption}
        />
        <MetricCard
          label="Stability"
          value={formatPercent(snapshot.stability)}
          detail="Composite of unemployment, budget pressure, demand, services, and exodus"
          tone={stabilityTone}
          meter={snapshot.stability / 100}
        />
        <MetricCard
          label="Unemployment"
          value={formatPercent(snapshot.unemploymentRate)}
          detail={`${formatInteger(snapshot.unemploymentWorkers)} without work, ${formatPercent(snapshot.longTermShare * 100)} of them for over 6 months`}
          tone={
            snapshot.unemploymentRate > 18
              ? "critical"
              : snapshot.unemploymentRate >
                  SIMULATION_BASELINES.naturalUnemploymentRate + 2
                ? "warning"
                : "stable"
          }
          meter={clamp(snapshot.unemploymentRate / 30, 0, 1)}
        />
        <MetricCard
          label="Household Income"
          value={formatCurrency(snapshot.householdIncome)}
          detail={
            snapshot.unemploymentSupportNeed === 0
              ? "No unemployment support is needed yet"
              : `${formatCurrency(snapshot.unemploymentSupport)} of ${formatCurrency(snapshot.unemploymentSupportNeed)} support still reaching households`
          }
          meter={clamp(snapshot.householdIncome / 5_400_000, 0, 1)}
        />
        <MetricCard
          label="City Budget"
          value={formatCurrency(snapshot.cityBudget)}
          detail={`${formatDeltaCurrency(snapshot.fiscalBalance)} this month after ${formatCurrency(snapshot.publicServiceCost)} in services and ${formatCurrency(snapshot.unemploymentSupport)} in support`}
          tone={
            snapshot.cityBudget < 0 || snapshot.fiscalBalance < 0
              ? "critical"
              : "stable"
          }
          meter={clamp((snapshot.cityBudget + 2_000_000) / 4_000_000, 0, 1)}
        />
        <MetricCard
          label="Demand"
          value={formatPercent(snapshot.demand)}
          detail={`Projected next month: ${formatPercent(snapshot.projectedNextDemand)}`}
          tone={snapshot.demand < 90 ? "warning" : "stable"}
          meter={snapshot.demand / 120}
        />
        <MetricCard
          label="White Collar Profit"
          value={formatCurrency(snapshot.whiteCollarProfit)}
          detail={`${formatCurrency(snapshot.whiteCollarRevenue)} revenue against ${formatCurrency(snapshot.whiteCollarPayroll)} payroll`}
          meter={clamp(snapshot.whiteCollarProfit / 5_000_000, 0, 1)}
        />
        <MetricCard
          label="AI Leakage Cost"
          value={formatCurrency(snapshot.aiLeakageCost)}
          detail="Spend leaving the city for external AI inputs and tooling"
          tone={snapshot.aiLeakageCost > 500_000 ? "warning" : "stable"}
          meter={clamp(snapshot.aiLeakageCost / 900_000, 0, 1)}
        />
        <MetricCard
          label="Labor Force"
          value={formatInteger(snapshot.laborForce)}
          detail={
            snapshot.outMigrants > 0
              ? `${formatInteger(snapshot.outMigrants)} residents have left the city for good`
              : "Nobody has left the city yet"
          }
          tone={
            snapshot.outMigrants > 60
              ? "critical"
              : snapshot.outMigrants > 20
                ? "warning"
                : "stable"
          }
          meter={clamp(snapshot.laborForce / SIMULATION_BASELINES.totalWorkforce, 0, 1)}
        />
        <MetricCard
          label="White Collar Wage"
          value={formatCurrency(snapshot.whiteCollarWage)}
          detail={`Wage index at ${formatPercent(snapshot.wageIndex * 100)} of baseline — slack erodes pay, AI productivity lifts it`}
          tone={snapshot.wageIndex < 0.92 ? "warning" : "stable"}
          meter={clamp((snapshot.wageIndex - 0.75) / 0.37, 0, 1)}
        />
        <MetricCard
          label="New AI-Era Jobs"
          value={formatInteger(snapshot.newRoleWorkers)}
          detail="Oversight, integration, and services that only exist once AI is embedded"
          meter={clamp(snapshot.newRoleWorkers / 110, 0, 1)}
        />
        <MetricCard
          label="Consumer Confidence"
          value={formatPercent(snapshot.consumerConfidence * 100)}
          detail="Households cut discretionary spending when the labor market and safety net weaken"
          tone={snapshot.consumerConfidence < 0.85 ? "warning" : "stable"}
          meter={clamp(snapshot.consumerConfidence, 0, 1)}
        />
      </section>

      {!hydrated && (
        <p className="text-sm text-muted-foreground">
          Restoring saved city state…
        </p>
      )}
    </div>
  );
}
