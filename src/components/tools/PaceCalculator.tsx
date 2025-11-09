import { useEffect, useMemo, useState } from "react";

type DistanceKey =
  | "fiveK"
  | "tenK"
  | "halfMarathon"
  | "marathon";

type DistanceDefinition = {
  key: DistanceKey;
  label: string;
  distanceKm: number;
  description: string;
};

const MILES_PER_KM = 0.621371;
const MAX_SUPPORTED_MINUTES = 24 * 60;

const DISTANCES: DistanceDefinition[] = [
  {
    key: "fiveK",
    label: "5 km",
    distanceKm: 5,
    description: "The classic weekend race distance.",
  },
  {
    key: "tenK",
    label: "10 km",
    distanceKm: 10,
    description: "A great checkpoint for tempo efforts.",
  },
  {
    key: "halfMarathon",
    label: "Half Marathon",
    distanceKm: 21.0975,
    description: "How you’ll feel at kilometre 21.",
  },
  {
    key: "marathon",
    label: "Marathon",
    distanceKm: 42.195,
    description: "The full 42.195 km experience.",
  },
];

const getRounded = (value: number, decimals = 2) => {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
};

const formatNumber = (value: number, decimals = 2) =>
  getRounded(value, decimals).toFixed(decimals);

const minutesToTimeString = (minutes: number) => {
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return "00:00:00";
  }

  const safeMinutes = Math.min(minutes, MAX_SUPPORTED_MINUTES - 0.016);
  const totalSeconds = Math.round(safeMinutes * 60);
  const hours = Math.floor(totalSeconds / 3600);
  const remainingSeconds = totalSeconds % 3600;
  const mins = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;

  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(hours)}:${pad(mins)}:${pad(seconds)}`;
};

const parseTimeToMinutes = (value: string) => {
  if (!value) return null;
  const segments = value.split(":").map((segment) => Number(segment || 0));

  if (segments.some(Number.isNaN)) return null;

  const [hours = 0, minutes = 0, seconds = 0] =
    segments.length === 2 ? [segments[0], segments[1], 0] : segments;

  const totalMinutes = hours * 60 + minutes + seconds / 60;

  if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) {
    return null;
  }

  return Math.min(totalMinutes, MAX_SUPPORTED_MINUTES);
};

const buildTimeState = (kph: number) => {
  if (!Number.isFinite(kph) || kph <= 0) {
    return {
      fiveK: "00:00:00",
      tenK: "00:00:00",
      halfMarathon: "00:00:00",
      marathon: "00:00:00",
    };
  }

  const minutesPerKm = 60 / kph;

  return DISTANCES.reduce(
    (accumulator, distance) => ({
      ...accumulator,
      [distance.key]: minutesToTimeString(minutesPerKm * distance.distanceKm),
    }),
    {} as Record<DistanceKey, string>,
  );
};

type SpeedTableRow = {
  kph: number;
  mph: number;
  minPerKm: string;
  minPerMile: string;
  times: Record<DistanceKey, string>;
};

const SPEED_TABLE_MIN = 3;
const SPEED_TABLE_MAX = 40;
const SPEED_TABLE_STEP = 0.5;

export default function PaceCalculator() {
  const [kph, setKph] = useState(12);
  const [kphInput, setKphInput] = useState(() => formatNumber(12));
  const [mphInput, setMphInput] = useState(() =>
    formatNumber(12 * MILES_PER_KM),
  );
  const [timeInputs, setTimeInputs] = useState<Record<DistanceKey, string>>(
    () => buildTimeState(12),
  );
  const [showSpeedTable, setShowSpeedTable] = useState(false);

  const minutesPerKm = useMemo(
    () => (kph > 0 ? 60 / kph : 0),
    [kph],
  );

  const minutesPerMile = useMemo(
    () => (minutesPerKm > 0 ? minutesPerKm / MILES_PER_KM : 0),
    [minutesPerKm],
  );

  const projectedDailyDistance = useMemo(
    () => (kph > 0 ? getRounded(kph * 24, 1) : 0),
    [kph],
  );

  const speedTableData = useMemo<SpeedTableRow[]>(() => {
    const rows: SpeedTableRow[] = [];
    for (
      let value = SPEED_TABLE_MIN;
      value <= SPEED_TABLE_MAX + SPEED_TABLE_STEP / 2;
      value += SPEED_TABLE_STEP
    ) {
      const roundedValue = getRounded(value, 1);
      const paceKm = 60 / roundedValue;
      const paceMile = paceKm / MILES_PER_KM;
      rows.push({
        kph: roundedValue,
        mph: getRounded(roundedValue * MILES_PER_KM, 2),
        minPerKm: minutesToTimeString(paceKm),
        minPerMile: minutesToTimeString(paceMile),
        times: buildTimeState(roundedValue),
      });
    }
    return rows;
  }, []);

  useEffect(() => {
    setTimeInputs(buildTimeState(kph));
  }, [kph]);

  const updateSpeedFromKph = (nextKph: number) => {
    const safeKph = Math.max(nextKph, 0.1);
    setKph(safeKph);
    setKphInput(formatNumber(safeKph));
    setMphInput(formatNumber(safeKph * MILES_PER_KM));
  };

  const handleKphChange = (value: string) => {
    setKphInput(value);
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue) || numericValue <= 0) return;
    updateSpeedFromKph(numericValue);
  };

  const handleMphChange = (value: string) => {
    setMphInput(value);
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue) || numericValue <= 0) return;
    const convertedKph = numericValue / MILES_PER_KM;
    updateSpeedFromKph(convertedKph);
  };

  const handleTimeChange = (value: string, key: DistanceKey) => {
    setTimeInputs((previous) => ({
      ...previous,
      [key]: value,
    }));

    const distanceDefinition = DISTANCES.find(
      (distance) => distance.key === key,
    );

    if (!distanceDefinition) return;

    const totalMinutes = parseTimeToMinutes(value);
    if (!totalMinutes) return;

    const nextKph =
      distanceDefinition.distanceKm / (totalMinutes / 60);

    if (!Number.isFinite(nextKph) || nextKph <= 0) return;

    updateSpeedFromKph(nextKph);
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 pb-16 pt-8 md:px-6 lg:px-8">
      <section className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-emerald-500/10 via-transparent to-blue-500/10 p-8 shadow-lg backdrop-blur-sm dark:from-emerald-500/20 dark:to-blue-500/20">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.12),transparent_60%)]" />
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="space-y-4">
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-300">
              Running Toolkit
            </span>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Pace &amp; Distance Calculator
            </h1>
            <p className="max-w-xl text-base leading-relaxed text-muted-foreground">
              Convert speeds, estimate race finish times, and understand your
              effort instantly. The calculator keeps KPH, MPH, and race splits
              in sync so you can plan training sessions for any distance.
            </p>
          </div>
          <div className="flex flex-col gap-4">
            {!showSpeedTable && (
              <div className="flex flex-col items-start gap-3 rounded-2xl border border-border bg-card/80 p-4 text-sm text-muted-foreground shadow-sm backdrop-blur-sm">
                <p className="text-xs uppercase tracking-widest text-muted-foreground">
                  At this speed you&apos;d cover
                </p>
                <div className="text-4xl font-semibold text-foreground">
                  {projectedDailyDistance}
                  <span className="ml-1 text-base font-normal text-muted-foreground">
                    km / day
                  </span>
                </div>
                <p>
                  That&apos;s{" "}
                  {formatNumber(projectedDailyDistance * MILES_PER_KM, 1)} miles
                  in 24 hours. Stay hydrated!
                </p>
              </div>
            )}
            <button
              type="button"
              onClick={() => setShowSpeedTable((previous) => !previous)}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-4 py-2 text-sm font-medium text-primary transition hover:bg-primary/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 dark:border-primary/30 dark:bg-primary/15 dark:text-primary-foreground"
            >
              <span>
                {showSpeedTable
                  ? "Back to calculator"
                  : "Show pace reference table"}
              </span>
              <span className="rounded-full bg-primary/20 px-2 py-0.5 text-xs text-primary">
                3 – 40 kph
              </span>
            </button>
          </div>
        </div>
      </section>

      {showSpeedTable ? (
        <section className="space-y-4 rounded-3xl border border-border bg-card/90 p-6 shadow-lg backdrop-blur-sm">
          <header className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">
              Pace reference table
            </h2>
            <p className="text-sm text-muted-foreground">
              Compare equivalent paces and race predictions from a gentle jog to
              a blazing fast 40 km/h sprint.
            </p>
          </header>

          <div className="overflow-hidden rounded-2xl border border-border">
            <div className="max-h-[420px] overflow-auto">
              <table className="min-w-full divide-y divide-border text-sm">
                <thead className="sticky top-0 z-10 bg-card/95 text-xs uppercase tracking-wide text-muted-foreground backdrop-blur-sm">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-left">
                      KPH
                    </th>
                    <th scope="col" className="px-4 py-3 text-left">
                      MPH
                    </th>
                    <th scope="col" className="px-4 py-3 text-left">
                      Min / km
                    </th>
                    <th scope="col" className="px-4 py-3 text-left">
                      Min / mile
                    </th>
                    {DISTANCES.map((distance) => (
                      <th
                        key={distance.key}
                        scope="col"
                        className="px-4 py-3 text-left"
                      >
                        {distance.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-muted/30 bg-background/40 text-foreground">
                  {speedTableData.map((row) => (
                    <tr
                      key={row.kph}
                      className="transition hover:bg-primary/5 dark:hover:bg-primary/10"
                    >
                      <td className="px-4 py-3 font-semibold">
                        {row.kph.toFixed(1)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {row.mph.toFixed(2)}
                      </td>
                      <td className="px-4 py-3">{row.minPerKm}</td>
                      <td className="px-4 py-3">{row.minPerMile}</td>
                      {DISTANCES.map((distance) => (
                        <td key={distance.key} className="px-4 py-3">
                          {row.times[distance.key]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : (
        <section className="grid gap-6 md:grid-cols-[1.1fr_0.9fr]">
          <div className="flex flex-col gap-6">
            <div className="space-y-6 rounded-2xl border border-border bg-card p-6 shadow-sm">
              <header className="space-y-1">
                <h2 className="text-lg font-semibold text-foreground">
                  Speed inputs
                </h2>
                <p className="text-sm text-muted-foreground">
                  Update either unit to synchronise the rest of the calculator.
                  Speeds are rounded to two decimal places.
                </p>
              </header>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2">
                  <span className="block text-sm font-medium text-muted-foreground">
                    Kilometres per hour (KPH)
                  </span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step={0.1}
                    value={kphInput}
                    onChange={(event) => handleKphChange(event.target.value)}
                    className="h-11 w-full rounded-lg border border-border bg-background px-3 text-base font-medium text-foreground shadow-inner transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </label>

                <label className="space-y-2">
                  <span className="block text-sm font-medium text-muted-foreground">
                    Miles per hour (MPH)
                  </span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step={0.1}
                    value={mphInput}
                    onChange={(event) => handleMphChange(event.target.value)}
                    className="h-11 w-full rounded-lg border border-border bg-background px-3 text-base font-medium text-foreground shadow-inner transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </label>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs uppercase tracking-wide text-muted-foreground">
                  <span>Adjust speed</span>
                  <span>{formatNumber(kph, 1)} kph</span>
                </div>
                <input
                  type="range"
                  min={4}
                  max={40}
                  step={0.1}
                  value={getRounded(kph, 1)}
                  onChange={(event) => {
                    const nextValue = Number(event.target.value);
                    if (!Number.isFinite(nextValue)) return;
                    updateSpeedFromKph(nextValue);
                  }}
                  className="h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
                />
              </div>
            </div>

            <div className="grid gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
              <header className="space-y-1">
                <h2 className="text-lg font-semibold text-foreground">
                  Pace insights
                </h2>
                <p className="text-sm text-muted-foreground">
                  Quick splits for one kilometre and one mile at your current
                  speed.
                </p>
              </header>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-border bg-background p-4 shadow-inner">
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">
                    Minutes per kilometre
                  </span>
                  <p className="mt-2 text-2xl font-semibold text-foreground">
                    {minutesPerKm > 0
                      ? minutesToTimeString(minutesPerKm)
                      : "00:00:00"}
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-background p-4 shadow-inner">
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">
                    Minutes per mile
                  </span>
                  <p className="mt-2 text-2xl font-semibold text-foreground">
                    {minutesPerMile > 0
                      ? minutesToTimeString(minutesPerMile)
                      : "00:00:00"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6 rounded-2xl border border-border bg-card p-6 shadow-sm">
            <header className="space-y-1">
              <h2 className="text-lg font-semibold text-foreground">
                Set a race time
              </h2>
              <p className="text-sm text-muted-foreground">
                Update any finish time to re-calculate your pace. Seconds are
                supported for precise race targets.
              </p>
            </header>

            <div className="space-y-6">
              {DISTANCES.map((distance) => (
                <div
                  key={distance.key}
                  className="rounded-2xl border border-border bg-background/60 p-4 shadow-inner transition hover:border-primary/40 hover:shadow-md"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-base font-semibold text-foreground">
                        {distance.label}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {distance.description}
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 sm:w-56">
                      <label className="space-y-2">
                        <span className="text-xs uppercase tracking-wide text-muted-foreground">
                          Finish time
                        </span>
                        <input
                          type="time"
                          step={1}
                          value={timeInputs[distance.key]}
                          onChange={(event) =>
                            handleTimeChange(event.target.value, distance.key)
                          }
                          className="h-11 w-full rounded-lg border border-border bg-card px-3 text-base font-medium text-foreground shadow-sm transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                      </label>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

