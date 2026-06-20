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
  type HistoryPoint,
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
  markerId: string;
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
    x: 44,
    y: 232,
    width: 180,
    height: 112,
  },
  {
    key: "whiteCollar",
    label: "White Collar Workers",
    caption: "50% of city jobs",
    shape: "rect",
    x: 275,
    y: 64,
    width: 300,
    height: 148,
  },
  {
    key: "cityHall",
    label: "City Hall",
    caption: "Taxes and support",
    shape: "rect",
    x: 754,
    y: 78,
    width: 196,
    height: 112,
  },
  {
    key: "schoolClinic",
    label: "School / Clinic",
    caption: "Public services",
    shape: "rect",
    x: 754,
    y: 314,
    width: 196,
    height: 112,
  },
  {
    key: "retail",
    label: "Retail",
    caption: "Shops and goods",
    shape: "rect",
    x: 52,
    y: 366,
    width: 178,
    height: 112,
  },
  {
    key: "households",
    label: "Households",
    caption: "Workers and demand",
    shape: "rect",
    x: 300,
    y: 344,
    width: 250,
    height: 132,
  },
  {
    key: "food",
    label: "Food",
    caption: "Cafes and groceries",
    shape: "rect",
    x: 52,
    y: 498,
    width: 178,
    height: 112,
  },
  {
    key: "housing",
    label: "Housing",
    caption: "Rent and upkeep",
    shape: "rect",
    x: 590,
    y: 452,
    width: 196,
    height: 112,
  },
];

const AI_ADOPTION_PRESETS = [0, 0.25, 0.5, 0.75, 1] as const;

type AnchorSide = "top" | "bottom" | "left" | "right";

const NODE_BY_KEY = Object.fromEntries(
  MAP_NODES.map((node) => [node.key, node]),
) as Record<MapNodeKey, MapNodeConfig>;

function anchorPoint(node: MapNodeConfig, side: AnchorSide) {
  const w = node.width ?? 0;
  const h = node.height ?? 0;
  switch (side) {
    case "top":
      return { x: node.x + w / 2, y: node.y };
    case "bottom":
      return { x: node.x + w / 2, y: node.y + h };
    case "left":
      return { x: node.x, y: node.y + h / 2 };
    case "right":
      return { x: node.x + w, y: node.y + h / 2 };
  }
}

function sideNormal(side: AnchorSide) {
  switch (side) {
    case "top":
      return { x: 0, y: -1 };
    case "bottom":
      return { x: 0, y: 1 };
    case "left":
      return { x: -1, y: 0 };
    case "right":
      return { x: 1, y: 0 };
  }
}

// Build a smooth connector that leaves the source node and arrives at the
// target node perpendicular to each edge, so flows always visibly attach to
// the boxes they link instead of floating across the map.
function connector(
  fromKey: MapNodeKey,
  fromSide: AnchorSide,
  toKey: MapNodeKey,
  toSide: AnchorSide,
  curve = 0.42,
) {
  const a = anchorPoint(NODE_BY_KEY[fromKey], fromSide);
  const b = anchorPoint(NODE_BY_KEY[toKey], toSide);
  const distance = Math.hypot(b.x - a.x, b.y - a.y);
  const offset = clamp(distance * curve, 36, 150);
  const na = sideNormal(fromSide);
  const nb = sideNormal(toSide);
  const c1 = { x: a.x + na.x * offset, y: a.y + na.y * offset };
  const c2 = { x: b.x + nb.x * offset, y: b.y + nb.y * offset };
  return `M ${a.x} ${a.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${b.x} ${b.y}`;
}

const FLOW_PATHS = {
  externalRevenue: connector("outsideClients", "right", "whiteCollar", "left"),
  wages: connector("whiteCollar", "bottom", "households", "top"),
  retailSpending: connector("households", "left", "retail", "right"),
  foodSpending: connector("households", "left", "food", "right"),
  housingSpending: connector("households", "right", "housing", "left"),
  whiteTaxes: connector("whiteCollar", "right", "cityHall", "left"),
  services: connector("cityHall", "bottom", "schoolClinic", "top"),
  support: connector("cityHall", "left", "households", "right"),
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
  markerId,
  maxAmount,
  path,
}: FlowPathProps) {
  const ratio = maxAmount === 0 ? 0 : clamp(amount / maxAmount, 0, 1);
  const strokeWidth = 1.6 + ratio * 3.2;
  const routeOpacity = amount > 0 ? 0.16 + ratio * 0.24 : 0.08;

  return (
    <g>
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeOpacity={routeOpacity}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        markerEnd={`url(#${markerId})`}
      />
      {amount > 0 && (
        <path
          d={path}
          fill="none"
          stroke={color}
          strokeOpacity={0.42 + ratio * 0.22}
          strokeWidth={Math.max(1.6, strokeWidth * 0.78)}
          strokeLinecap="round"
          strokeDasharray="22 150"
        >
          <animate
            attributeName="stroke-dashoffset"
            begin={`${delay}s`}
            dur={`${duration}s`}
            from="172"
            repeatCount="indefinite"
            to="0"
          />
        </path>
      )}
    </g>
  );
}

function FlowLegendChip({
  color,
  detail,
  label,
}: {
  color: string;
  detail: string;
  label: string;
}) {
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs text-muted-foreground"
      style={{
        borderColor: "var(--map-legend-border)",
        backgroundColor: "var(--map-legend-bg)",
      }}
    >
      <span
        className="h-2 w-6 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
      <span>
        <span className="font-semibold text-foreground">{label}</span>
        <span className="hidden sm:inline">: {detail}</span>
      </span>
    </span>
  );
}

function toneColor(tone: "stable" | "warning" | "critical") {
  if (tone === "critical") return "oklch(0.66 0.19 28)";
  if (tone === "warning") return "oklch(0.77 0.15 78)";
  return "oklch(0.7 0.12 190)";
}

type TimelineChartProps = {
  history: HistoryPoint[];
  stabilityColor: string;
};

// A growing trajectory of the city: stability and unemployment read against a
// shared 0-100 axis (they cross as a city tips over), with AI adoption rising
// behind them as the underlying driver.
function TimelineChart({ history, stabilityColor }: TimelineChartProps) {
  const W = 1000;
  const H = 300;
  const padL = 30;
  const padR = 20;
  const padT = 22;
  const padB = 30;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const started = history.length > 1;
  const first = history[0];
  const last = history[history.length - 1];
  const m0 = first ? first.month : 0;
  const latest = last ? last.month : 0;
  const span = Math.max(latest - m0, 12);

  const xFor = (month: number) => padL + ((month - m0) / span) * plotW;
  const yFor = (value: number) => padT + (1 - clamp(value, 0, 100) / 100) * plotH;

  const linePath = (selector: (point: HistoryPoint) => number) =>
    history
      .map(
        (point, index) =>
          `${index === 0 ? "M" : "L"} ${xFor(point.month).toFixed(1)} ${yFor(
            selector(point),
          ).toFixed(1)}`,
      )
      .join(" ");

  const areaPath = (selector: (point: HistoryPoint) => number) =>
    history.length
      ? `${linePath(selector)} L ${xFor(latest).toFixed(1)} ${yFor(0).toFixed(
          1,
        )} L ${xFor(m0).toFixed(1)} ${yFor(0).toFixed(1)} Z`
      : "";

  const stabilityOf = (point: HistoryPoint) => point.stability;
  const unemploymentOf = (point: HistoryPoint) => point.unemployment;
  const adoptionOf = (point: HistoryPoint) => point.aiAdoption * 100;

  const gridGuides = [25, 50, 75];
  const monthTicks = started
    ? Array.from({ length: 5 }, (_, index) =>
        Math.round(m0 + (span * index) / 4),
      ).filter((value, index, all) => all.indexOf(value) === index)
    : [];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="block aspect-[1000/300] w-full"
      role="img"
      aria-label="City stability, unemployment, and AI adoption over time"
    >
      {/* horizontal guides */}
      {gridGuides.map((value) => (
        <line
          key={`guide-${value}`}
          x1={padL}
          x2={W - padR}
          y1={yFor(value)}
          y2={yFor(value)}
          stroke="var(--map-grid)"
          strokeWidth={1}
          strokeOpacity={0.4}
        />
      ))}

      {/* crisis threshold */}
      <line
        x1={padL}
        x2={W - padR}
        y1={yFor(30)}
        y2={yFor(30)}
        stroke="oklch(0.66 0.19 28)"
        strokeWidth={1}
        strokeDasharray="3 6"
        strokeOpacity={0.55}
      />
      <text
        x={W - padR}
        y={yFor(30) - 6}
        textAnchor="end"
        fontSize={11}
        fontWeight={600}
        fill="oklch(0.66 0.19 28)"
        fillOpacity={0.85}
      >
        crisis line
      </text>

      {started ? (
        <>
          {/* AI adoption: the underlying driver, faint behind everything */}
          <path d={areaPath(adoptionOf)} fill="var(--tool-accent)" fillOpacity={0.1} />
          <path
            d={linePath(adoptionOf)}
            fill="none"
            stroke="var(--tool-accent)"
            strokeOpacity={0.5}
            strokeWidth={1.6}
            strokeDasharray="2 5"
            strokeLinecap="round"
          />

          {/* Unemployment */}
          <path
            d={linePath(unemploymentOf)}
            fill="none"
            stroke="var(--timeline-unemployment)"
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Stability: the hero line, tone-coloured */}
          <path d={areaPath(stabilityOf)} fill={stabilityColor} fillOpacity={0.12} />
          <path
            d={linePath(stabilityOf)}
            fill="none"
            stroke={stabilityColor}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle
            cx={xFor(latest)}
            cy={yFor(last.stability)}
            r={4.5}
            fill={stabilityColor}
            stroke="hsl(var(--card))"
            strokeWidth={2}
          />

          {monthTicks.map((month) => (
            <text
              key={`tick-${month}`}
              x={xFor(month)}
              y={H - 8}
              textAnchor="middle"
              fontSize={11}
              fill="var(--map-metric)"
              fillOpacity={0.65}
            >
              m{month}
            </text>
          ))}
        </>
      ) : (
        <text
          x={W / 2}
          y={H / 2}
          textAnchor="middle"
          fontSize={15}
          fill="var(--map-metric)"
          fillOpacity={0.7}
        >
          Press play. The city&apos;s trajectory draws here, month by month.
        </text>
      )}
    </svg>
  );
}

// A dense readout row: label, value, and a thin meter. Tone colour only shows
// up when a metric is under strain, so a calm city reads calm.
function Vital({ label, value, detail, tone = "stable", meter = 0.5 }: MetricCardProps) {
  const color = toneColor(tone);

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="text-sm font-semibold tabular-nums text-foreground">
          {value}
        </span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-muted/70">
        <div
          className="h-full rounded-full transition-[width] duration-300 ease-out"
          style={{
            width: `${clamp(meter, 0, 1) * 100}%`,
            backgroundColor: color,
          }}
        />
      </div>
      {detail && (
        <p className="text-xs leading-5 text-muted-foreground/80">{detail}</p>
      )}
    </div>
  );
}

function MapNode({ config, selected, snapshot, onSelect }: MapNodeProps) {
  const metricLines = getNodeMetricLines(config.key, snapshot);
  const width = config.width ?? 0;
  const height = config.height ?? 0;
  const isPrimary = config.key === "whiteCollar";
  const isCompact = height <= 102;
  const radius = config.shape === "pill" ? 24 : 18;
  const inset = isPrimary ? 28 : 20;
  const titleX = config.width ? config.x + inset : config.x;
  const titleY = config.shape === "circle" ? config.y - 16 : config.y + (isPrimary ? 44 : 31);
  const captionY = config.shape === "circle" ? config.y + 6 : config.y + (isPrimary ? 74 : 55);
  const metricStartY =
    config.shape === "circle"
      ? config.y + 32
      : config.y + (isPrimary ? 112 : isCompact ? 76 : 86);
  const metricStep = isPrimary ? 22 : isCompact ? 16 : 18;
  const captionWidth = Math.min(
    Math.max(config.caption.length * (isPrimary ? 7.4 : 6.7) + 24, isPrimary ? 142 : 92),
    Math.max(width - inset * 2, 80),
  );
  const captionHeight = isPrimary ? 22 : 18;
  const accentFill =
    isPrimary
      ? "var(--map-node-primary)"
      : config.key === "cityHall" || config.key === "schoolClinic"
        ? "var(--map-node-civic)"
        : config.key === "outsideClients"
          ? "var(--map-node-external)"
          : "var(--map-node)";

  const borderColor =
    isPrimary
      ? "var(--map-node-border-primary)"
      : selected
        ? "var(--map-node-border-selected)"
        : "var(--map-node-border)";
  const textColor = isPrimary ? "var(--map-text-primary)" : "var(--map-text)";

  const handleSelect = () => onSelect(config.key);

  return (
    <g
      className="group outline-none"
      role="button"
      tabIndex={0}
      aria-label={`Inspect ${config.label}`}
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
      <title>
        {selected ? "Selected" : "Select"} {config.label}
      </title>
      {selected && config.shape !== "circle" && (
        <rect
          x={config.x - 7}
          y={config.y - 7}
          width={width + 14}
          height={height + 14}
          rx={radius + 7}
          fill="var(--map-selection-fill)"
          stroke="var(--map-selection)"
          strokeWidth={3}
        />
      )}

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
          width={width}
          height={height}
          rx={radius}
          fill={accentFill}
          stroke={borderColor}
          strokeWidth={selected ? 3 : 1.8}
        />
      )}

      {!selected && config.shape !== "circle" && (
        <rect
          className="opacity-0 transition-opacity duration-150 group-hover:opacity-70 group-focus-visible:opacity-100"
          x={config.x + 3}
          y={config.y + 3}
          width={width - 6}
          height={height - 6}
          rx={Math.max(radius - 3, 12)}
          fill="none"
          stroke="var(--map-node-border-selected)"
          strokeWidth={2.4}
        />
      )}

      {selected && config.shape !== "circle" && (
        <circle
          cx={config.x + width - 19}
          cy={config.y + 19}
          r={5}
          fill="var(--map-selected-dot)"
        />
      )}

      <text
        x={titleX}
        y={titleY}
        textAnchor={config.shape === "circle" ? "middle" : "start"}
        fill={textColor}
        fontSize={isPrimary ? 20 : isCompact ? 15 : 16}
        fontWeight={700}
      >
        {config.label}
      </text>

      {config.shape !== "circle" && (
        <rect
          x={titleX - 2}
          y={captionY - captionHeight + 5}
          width={captionWidth}
          height={captionHeight}
          rx={captionHeight / 2}
          fill={isPrimary ? "var(--map-caption-bg-primary)" : "var(--map-caption-bg)"}
        />
      )}
      <text
        x={titleX + (config.shape === "circle" ? 0 : 10)}
        y={captionY}
        textAnchor={config.shape === "circle" ? "middle" : "start"}
        fill="var(--map-caption)"
        fontSize={isPrimary ? 11 : 10.5}
        fontWeight={700}
        letterSpacing="0"
      >
        {config.caption.toUpperCase()}
      </text>

      {metricLines.map((line, index) => (
        <text
          key={`${config.key}-${line}`}
          x={titleX}
          y={metricStartY + index * metricStep}
          textAnchor={config.shape === "circle" ? "middle" : "start"}
          fill="var(--map-metric)"
          fontSize={isPrimary ? 13.5 : isCompact ? 11.5 : 12}
          fontWeight={600}
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
      history: Array.isArray(parsed.history) ? parsed.history : [],
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
  const flowArrowId = `city-flow-arrow-${gradientId}`;

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
  const metricCards: MetricCardProps[] = [
    {
      label: "Month",
      value: formatInteger(snapshot.month),
      detail: state.isPlaying
        ? `Advancing at ${getSpeedLabel(state.speed)}`
        : "Paused at the current city snapshot",
      meter: Math.min(snapshot.month / 24, 1),
    },
    {
      label: "AI Adoption",
      value: formatPercent(snapshot.aiAdoption * 100),
      detail:
        snapshot.aiAdoptionTarget > snapshot.aiAdoption + 0.005
          ? `Rolling out toward the ${formatPercent(snapshot.aiAdoptionTarget * 100)} target`
          : snapshot.aiAdoptionTarget < snapshot.aiAdoption - 0.005
            ? `Slowly unwinding toward the ${formatPercent(snapshot.aiAdoptionTarget * 100)} target`
            : "Adoption has reached the current target",
      meter: snapshot.aiAdoption,
    },
    {
      label: "Stability",
      value: formatPercent(snapshot.stability),
      detail:
        "Composite of unemployment, budget pressure, demand, services, and exodus",
      tone: stabilityTone,
      meter: snapshot.stability / 100,
    },
    {
      label: "Unemployment",
      value: formatPercent(snapshot.unemploymentRate),
      detail: `${formatInteger(snapshot.unemploymentWorkers)} without work, ${formatPercent(snapshot.longTermShare * 100)} of them for over 6 months`,
      tone:
        snapshot.unemploymentRate > 18
          ? "critical"
          : snapshot.unemploymentRate >
              SIMULATION_BASELINES.naturalUnemploymentRate + 2
            ? "warning"
            : "stable",
      meter: clamp(snapshot.unemploymentRate / 30, 0, 1),
    },
    {
      label: "Household Income",
      value: formatCurrency(snapshot.householdIncome),
      detail:
        snapshot.unemploymentSupportNeed === 0
          ? "No unemployment support is needed yet"
          : `${formatCurrency(snapshot.unemploymentSupport)} of ${formatCurrency(snapshot.unemploymentSupportNeed)} support still reaching households`,
      meter: clamp(snapshot.householdIncome / 5_400_000, 0, 1),
    },
    {
      label: "City Budget",
      value: formatCurrency(snapshot.cityBudget),
      detail: `${formatDeltaCurrency(snapshot.fiscalBalance)} this month after ${formatCurrency(snapshot.publicServiceCost)} in services and ${formatCurrency(snapshot.unemploymentSupport)} in support`,
      tone:
        snapshot.cityBudget < 0 || snapshot.fiscalBalance < 0
          ? "critical"
          : "stable",
      meter: clamp((snapshot.cityBudget + 2_000_000) / 4_000_000, 0, 1),
    },
    {
      label: "Demand",
      value: formatPercent(snapshot.demand),
      detail: `Projected next month: ${formatPercent(snapshot.projectedNextDemand)}`,
      tone: snapshot.demand < 90 ? "warning" : "stable",
      meter: snapshot.demand / 120,
    },
    {
      label: "White Collar Profit",
      value: formatCurrency(snapshot.whiteCollarProfit),
      detail: `${formatCurrency(snapshot.whiteCollarRevenue)} revenue against ${formatCurrency(snapshot.whiteCollarPayroll)} payroll`,
      meter: clamp(snapshot.whiteCollarProfit / 5_000_000, 0, 1),
    },
    {
      label: "AI Leakage Cost",
      value: formatCurrency(snapshot.aiLeakageCost),
      detail: "Spend leaving the city for external AI inputs and tooling",
      tone: snapshot.aiLeakageCost > 500_000 ? "warning" : "stable",
      meter: clamp(snapshot.aiLeakageCost / 900_000, 0, 1),
    },
    {
      label: "Labor Force",
      value: formatInteger(snapshot.laborForce),
      detail:
        snapshot.outMigrants > 0
          ? `${formatInteger(snapshot.outMigrants)} residents have left the city for good`
          : "Nobody has left the city yet",
      tone:
        snapshot.outMigrants > 60
          ? "critical"
          : snapshot.outMigrants > 20
            ? "warning"
            : "stable",
      meter: clamp(
        snapshot.laborForce / SIMULATION_BASELINES.totalWorkforce,
        0,
        1,
      ),
    },
    {
      label: "White Collar Wage",
      value: formatCurrency(snapshot.whiteCollarWage),
      detail:
        "Wage index tracks labor slack and AI productivity pressure against the baseline",
      tone: snapshot.wageIndex < 0.92 ? "warning" : "stable",
      meter: clamp((snapshot.wageIndex - 0.75) / 0.37, 0, 1),
    },
    {
      label: "New AI-Era Jobs",
      value: formatInteger(snapshot.newRoleWorkers),
      detail:
        "Oversight, integration, and services that only exist once AI is embedded",
      meter: clamp(snapshot.newRoleWorkers / 110, 0, 1),
    },
    {
      label: "Consumer Confidence",
      value: formatPercent(snapshot.consumerConfidence * 100),
      detail:
        "Households cut discretionary spending when the labor market and safety net weaken",
      tone: snapshot.consumerConfidence < 0.85 ? "warning" : "stable",
      meter: clamp(snapshot.consumerConfidence, 0, 1),
    },
  ];

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

  const stabilityColor = toneColor(stabilityTone);
  const previousPoint =
    state.history.length > 1
      ? state.history[state.history.length - 2]
      : undefined;
  const stabilityDelta = previousPoint
    ? snapshot.stability - previousPoint.stability
    : 0;
  const stabilityState =
    stabilityTone === "stable"
      ? "Holding steady"
      : stabilityTone === "warning"
        ? "Under strain"
        : "In crisis";

  const metricByLabel = new Map(
    metricCards.map((metric) => [metric.label, metric]),
  );
  const vitalGroups: { title: string; labels: string[] }[] = [
    {
      title: "Labor market",
      labels: [
        "Unemployment",
        "Labor Force",
        "New AI-Era Jobs",
        "White Collar Wage",
      ],
    },
    {
      title: "Public money",
      labels: [
        "City Budget",
        "Household Income",
        "White Collar Profit",
        "AI Leakage Cost",
      ],
    },
    {
      title: "Adoption & demand",
      labels: ["AI Adoption", "Demand", "Consumer Confidence"],
    },
  ];

  return (
    <div className="tools-shell-wide flex flex-col gap-6">
      <section className="tool-panel-lg overflow-hidden">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-3">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-[color:var(--tool-accent-text)]">
              Automation, traced through a city
            </p>
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-[2.55rem]">
                AI City Simulator
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base sm:leading-7">
                Set an AI adoption target for the white-collar sector and watch
                the shock ripple through a 1,000-worker city over months:
                gradual rollout, capped layoff waves, long-term unemployment,
                wage erosion, new AI-era jobs, strained budgets, and
                out-migration.
                <span className="hidden sm:inline">
                  {" "}Scale the city up mentally to a region or country: the
                  relative dynamics stay the same.
                </span>
              </p>
            </div>
          </div>

          <div
            className="rounded-[1.3rem] border px-4 py-4 sm:px-5"
            style={{
              borderColor:
                "color-mix(in oklch, var(--tool-accent) 28%, hsl(var(--border)) 72%)",
              background:
                "linear-gradient(135deg, color-mix(in oklch, hsl(var(--card)) 90%, var(--tool-accent) 10%) 0%, color-mix(in oklch, hsl(var(--card)) 78%, var(--tool-accent) 22%) 100%)",
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
            borderColor: "var(--tool-warn-border)",
            background: "var(--tool-warn-bg)",
          }}
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-stretch md:gap-6">
            <div className="flex flex-1 gap-3">
              <AlertTriangle
                className="mt-0.5 h-5 w-5 shrink-0"
                style={{ color: "var(--tool-warn-icon)" }}
              />
              <div className="space-y-1.5">
                <p
                  className="text-sm font-semibold uppercase tracking-[0.18em]"
                  style={{ color: "var(--tool-warn-title)" }}
                >
                  Collapse Warning
                </p>
                <div className="space-y-1">
                  {warnings.map((warning) => (
                    <p
                      key={warning}
                      className="text-sm leading-6"
                      style={{ color: "var(--tool-warn-text)" }}
                    >
                      {warning}
                    </p>
                  ))}
                </div>
              </div>
            </div>
            <p
              className="text-sm leading-6 md:max-w-xs md:border-l md:pl-6"
              style={{
                color: "var(--tool-warn-text)",
                borderColor: "var(--tool-warn-divider)",
              }}
            >
              {getNarrative(snapshot)}
            </p>
          </div>
        </section>
      )}

      <section className="grid items-stretch gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(20rem,0.9fr)]">
        <div className="tool-panel-lg flex min-w-0 flex-col gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
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
            <div className="flex flex-wrap gap-2 text-xs font-medium text-muted-foreground sm:justify-end">
              <span
                className="rounded-full border px-3 py-1.5"
                style={{
                  borderColor: "var(--map-legend-border)",
                  backgroundColor: "var(--map-legend-bg)",
                }}
              >
                Demand {formatPercent(snapshot.demand)}
              </span>
              <span
                className="rounded-full border px-3 py-1.5"
                style={{
                  borderColor: "var(--map-legend-border)",
                  backgroundColor: "var(--map-legend-bg)",
                }}
              >
                Next month {formatPercent(snapshot.projectedNextDemand)}
              </span>
            </div>
          </div>

          <div
            className="flex flex-1 items-center overflow-x-auto overflow-y-hidden rounded-[1.25rem] border p-2.5 sm:p-3"
            style={{
              borderColor: "var(--map-panel-border)",
              background:
                "linear-gradient(180deg, var(--map-panel-from) 0%, var(--map-panel-to) 100%)",
            }}
          >
            <svg
              viewBox="0 0 1000 640"
              className="block aspect-[1000/640] min-w-[42rem] w-full"
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
                  <stop offset="0%" stopColor="var(--map-surface-from)" />
                  <stop offset="100%" stopColor="var(--map-surface-to)" />
                </linearGradient>
                <marker
                  id={flowArrowId}
                  markerHeight="12"
                  markerUnits="userSpaceOnUse"
                  markerWidth="12"
                  orient="auto"
                  refX="10"
                  refY="6"
                  viewBox="0 0 12 12"
                >
                  <path d="M 1 2 L 10 6 L 1 10 z" fill="context-stroke" />
                </marker>
              </defs>

              <rect
                x="12"
                y="12"
                width="976"
                height="616"
                rx="28"
                fill={`url(#city-grid-${gradientId})`}
              />
              <g style={{ opacity: "var(--map-grid-opacity)" }}>
                {Array.from({ length: 9 }).map((_, index) => (
                  <line
                    key={`h-${index}`}
                    x1="40"
                    x2="960"
                    y1={66 + index * 60}
                    y2={66 + index * 60}
                    stroke="var(--map-grid)"
                    strokeWidth="1"
                  />
                ))}
                {Array.from({ length: 10 }).map((_, index) => (
                  <line
                    key={`v-${index}`}
                    y1="42"
                    y2="600"
                    x1={68 + index * 92}
                    x2={68 + index * 92}
                    stroke="var(--map-grid)"
                    strokeWidth="1"
                  />
                ))}
              </g>

              <FlowPath
                amount={snapshot.outsideRevenue}
                color="var(--map-flow-revenue)"
                markerId={flowArrowId}
                maxAmount={maxFlowAmount}
                path={FLOW_PATHS.externalRevenue}
                duration={4.6}
              />
              <FlowPath
                amount={snapshot.whiteCollarPayroll}
                color="var(--map-flow-wage)"
                markerId={flowArrowId}
                maxAmount={maxFlowAmount}
                path={FLOW_PATHS.wages}
                duration={4.2}
                delay={0.5}
              />
              <FlowPath
                amount={snapshot.sectorRevenue.retail}
                color="var(--map-flow-spending)"
                markerId={flowArrowId}
                maxAmount={maxFlowAmount}
                path={FLOW_PATHS.retailSpending}
                duration={5.4}
                delay={0.3}
              />
              <FlowPath
                amount={snapshot.sectorRevenue.food}
                color="var(--map-flow-spending)"
                markerId={flowArrowId}
                maxAmount={maxFlowAmount}
                path={FLOW_PATHS.foodSpending}
                duration={5.7}
                delay={0.8}
              />
              <FlowPath
                amount={snapshot.sectorRevenue.housing}
                color="var(--map-flow-spending)"
                markerId={flowArrowId}
                maxAmount={maxFlowAmount}
                path={FLOW_PATHS.housingSpending}
                duration={5.1}
                delay={0.2}
              />
              <FlowPath
                amount={snapshot.taxRevenue}
                color="var(--map-flow-civic)"
                markerId={flowArrowId}
                maxAmount={maxFlowAmount}
                path={FLOW_PATHS.whiteTaxes}
                duration={4.7}
              />
              <FlowPath
                amount={snapshot.publicServiceCost}
                color="var(--map-flow-civic)"
                markerId={flowArrowId}
                maxAmount={maxFlowAmount}
                path={FLOW_PATHS.services}
                duration={3.9}
              />
              <FlowPath
                amount={snapshot.unemploymentSupport}
                color="var(--map-flow-support)"
                markerId={flowArrowId}
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

          <div className="flex flex-wrap gap-2">
            <FlowLegendChip
              color="var(--map-flow-revenue)"
              label="Revenue"
              detail="outside demand"
            />
            <FlowLegendChip
              color="var(--map-flow-wage)"
              label="Payroll"
              detail="wages to households"
            />
            <FlowLegendChip
              color="var(--map-flow-spending)"
              label="Spending"
              detail="household demand"
            />
            <FlowLegendChip
              color="var(--map-flow-civic)"
              label="Civic"
              detail="taxes and services"
            />
            <FlowLegendChip
              color="var(--map-flow-support)"
              label="Support"
              detail="benefits to households"
            />
          </div>
        </div>

        <div className="min-w-0 space-y-6">
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

      <section className="tool-panel-lg space-y-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-[color:var(--tool-accent-text)]">
              City stability over time
            </p>
            <div className="mt-2 flex items-baseline gap-3">
              <span
                className="text-5xl font-semibold tabular-nums tracking-tight"
                style={{ color: stabilityColor }}
              >
                {formatPercent(snapshot.stability)}
              </span>
              {Math.abs(stabilityDelta) >= 0.1 && (
                <span
                  className="text-sm font-semibold tabular-nums"
                  style={{
                    color:
                      stabilityDelta > 0
                        ? "oklch(0.7 0.13 165)"
                        : "oklch(0.66 0.19 28)",
                  }}
                >
                  {stabilityDelta > 0 ? "▲" : "▼"}{" "}
                  {Math.abs(stabilityDelta).toFixed(1)}/mo
                </span>
              )}
            </div>
            <p className="mt-1 text-sm font-medium text-muted-foreground">
              {stabilityState} at month {snapshot.month}
            </p>
          </div>

          <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium text-muted-foreground">
            <span className="inline-flex items-center gap-2">
              <span
                className="h-2.5 w-4 rounded-full"
                style={{ backgroundColor: stabilityColor }}
                aria-hidden="true"
              />
              Stability
            </span>
            <span className="inline-flex items-center gap-2">
              <span
                className="h-2.5 w-4 rounded-full"
                style={{ backgroundColor: "var(--timeline-unemployment)" }}
                aria-hidden="true"
              />
              Unemployment {formatPercent(snapshot.unemploymentRate)}
            </span>
            <span className="inline-flex items-center gap-2">
              <span
                className="h-2.5 w-4 rounded-full opacity-60"
                style={{ backgroundColor: "var(--tool-accent)" }}
                aria-hidden="true"
              />
              AI adoption {formatPercent(snapshot.aiAdoption * 100)}
            </span>
          </div>
        </div>

        <div
          className="overflow-hidden rounded-[1.25rem] border p-3"
          style={{
            borderColor: "var(--map-panel-border)",
            background:
              "linear-gradient(180deg, var(--map-panel-from) 0%, var(--map-panel-to) 100%)",
          }}
        >
          <TimelineChart history={state.history} stabilityColor={stabilityColor} />
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {vitalGroups.map((group) => (
          <div key={group.title} className="tool-panel-lg space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {group.title}
            </p>
            <div className="space-y-4">
              {group.labels.map((label) => {
                const metric = metricByLabel.get(label);
                if (!metric) return null;
                return <Vital key={label} {...metric} />;
              })}
            </div>
          </div>
        ))}
      </section>

      {!hydrated && (
        <p className="text-sm text-muted-foreground">
          Restoring saved city state…
        </p>
      )}
    </div>
  );
}
