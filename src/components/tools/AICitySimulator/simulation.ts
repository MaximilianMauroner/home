export type SimulationSpeed = 1 | 2 | 4;

export type MapNodeKey =
  | "whiteCollar"
  | "households"
  | "retail"
  | "food"
  | "housing"
  | "cityHall"
  | "schoolClinic"
  | "outsideClients";

type LocalSectorKey = "retail" | "food" | "housing";

export type SimulatorState = {
  month: number;
  /** Where the player wants adoption to go. */
  aiAdoptionTarget: number;
  /** Where adoption actually is; diffuses toward the target over months. */
  aiAdoption: number;
  demand: number;
  consumerConfidence: number;
  /** White-collar wage level relative to baseline; responds to labor slack. */
  wageIndex: number;
  cityBudget: number;
  whiteCollarWorkers: number;
  newRoleWorkers: number;
  retailWorkers: number;
  foodWorkers: number;
  housingWorkers: number;
  schoolClinicWorkers: number;
  cityHallWorkers: number;
  shortTermUnemployed: number;
  longTermUnemployed: number;
  isPlaying: boolean;
  speed: SimulationSpeed;
  selectedNode: MapNodeKey;
};

export type EconomySnapshot = {
  month: number;
  aiAdoption: number;
  aiAdoptionTarget: number;
  demand: number;
  projectedNextDemand: number;
  stability: number;
  laborForce: number;
  outMigrants: number;
  consumerConfidence: number;
  wageIndex: number;
  whiteCollarWage: number;
  householdIncome: number;
  householdSpending: number;
  cityBudget: number;
  taxRevenue: number;
  fiscalBalance: number;
  debtInterest: number;
  whiteCollarRevenue: number;
  whiteCollarPayroll: number;
  whiteCollarProfit: number;
  whiteCollarWorkers: number;
  newRoleWorkers: number;
  newRolePayroll: number;
  outsideRevenue: number;
  aiLeakageCost: number;
  publicServiceNeed: number;
  publicServiceCost: number;
  publicServiceLevel: number;
  unemploymentSupportNeed: number;
  unemploymentSupport: number;
  supportCoverage: number;
  unemploymentWorkers: number;
  shortTermUnemployed: number;
  longTermUnemployed: number;
  longTermShare: number;
  unemploymentRate: number;
  employedWorkers: number;
  sectorRevenue: Record<LocalSectorKey, number>;
  sectorWorkers: Record<LocalSectorKey | "schoolClinic" | "cityHall", number>;
  sectorPayroll: Record<LocalSectorKey | "schoolClinic" | "cityHall", number>;
  collapseRisk: {
    stability: boolean;
    unemployment: boolean;
    budget: boolean;
    services: boolean;
    support: boolean;
    exodus: boolean;
  };
};

export const AI_CITY_SIMULATOR_STORAGE_KEY = "ai-city-simulator";

const MAP_NODE_KEYS: MapNodeKey[] = [
  "whiteCollar",
  "households",
  "retail",
  "food",
  "housing",
  "cityHall",
  "schoolClinic",
  "outsideClients",
];

// The city is a 1,000-worker representative slice: scale it up mentally to a
// metro region or small country and the relative dynamics stay the same.
const TOTAL_BASE_LABOR_FORCE = 1_000;
// Baseline frictional unemployment: people are always between jobs even in a
// healthy economy, so "full employment" is ~5.4%, not 0%.
const NATURAL_UNEMPLOYMENT_RATE = 5.4;
const BASE_SHORT_TERM_UNEMPLOYED = 30;
const BASE_LONG_TERM_UNEMPLOYED = 24;
// ~2% of workers change jobs in a normal month; this churn is what lets the
// short-term unemployed pool empty out again instead of aging into long-term.
const MONTHLY_CHURN_RATE = 0.02;
// After ~6 months without work, the unemployed shift into the long-term pool
// where re-hire odds are worse and benefits are partially exhausted.
const SHORT_TO_LONG_TERM_RATE = 1 / 6;
// Long-term unemployed are roughly half as likely to be matched to an opening.
const LONG_TERM_MATCH_PENALTY = 0.45;
// Only a fraction of the unemployed can realistically be matched to openings
// in any single month (search and retraining friction).
const MONTHLY_MATCHING_EFFICIENCY = 0.35;

const WHITE_COLLAR_BASE_WORKERS = 500;
const WHITE_COLLAR_BASE_WAGE = 4_800;
const WHITE_COLLAR_BASE_REVENUE = 4_200_000;
// At full adoption: firms produce ~22% more output, AI performs ~45% of the
// labor input, and ~$1.05M/month flows out to external AI vendors.
const AI_OUTPUT_BOOST = 0.22;
const AI_TASK_DISPLACEMENT = 0.45;
const AI_LEAKAGE_MAX = 1_050_000;
// Adoption ramps toward the target slowly (procurement, integration, trust),
// and unwinds even more slowly once workflows depend on it.
const AI_ADOPTION_RAMP_UP = 0.07;
const AI_ADOPTION_RAMP_DOWN = 0.035;

// New AI-era roles (oversight, integration, data work, services that become
// viable when cognitive work gets cheap). At full adoption and healthy demand
// they can reabsorb up to ~22% of the original white-collar headcount.
const NEW_ROLE_SHARE = 0.22;
const NEW_ROLE_WAGE = 5_200;
const NEW_ROLE_OUTPUT_PER_WORKER = 7_200;

const SALES_TAX_RATE = 0.06;
const PROFIT_TAX_RATE = 0.09;
const PAYROLL_TAX_RATE = 0.055;
const SUPPORT_PER_PERSON = 1_600;
// Long-term unemployed have partially exhausted their benefits.
const LONG_TERM_BENEFIT_RATIO = 0.6;
const BASE_PUBLIC_SERVICE_OPERATIONS = 185_000;
const BASE_CITY_BUDGET = 950_000;
// Running a deficit isn't free: ~0.4%/month on the shortfall.
const DEBT_INTEREST_RATE = 0.004;

// Households spend most of each wage dollar locally and nearly all of each
// benefit dollar; confidence scales discretionary spending up or down.
const MPC_WAGES = 0.78;
const MPC_BENEFITS = 0.95;

const BASE_SECTORS = {
  retail: {
    workers: 146,
    revenue: 1_140_000,
    wage: 3_400,
    demandSensitivity: 0.95,
  },
  food: {
    workers: 110,
    revenue: 870_000,
    wage: 3_200,
    demandSensitivity: 0.85,
  },
  housing: {
    workers: 118,
    revenue: 1_010_000,
    wage: 3_900,
    demandSensitivity: 0.6,
  },
} as const;

const BASE_SCHOOL_CLINIC_WORKERS = 42;
const SCHOOL_CLINIC_WAGE = 4_300;
const BASE_CITY_HALL_WORKERS = 30;
const CITY_HALL_WAGE = 4_200;

// How fast each part of the economy can actually hire and fire. Layoffs are
// capped per month: even a failing firm sheds people in waves, not all at once.
const ADJUSTMENT_SPEEDS = {
  whiteCollar: { hire: 0.06, fire: 0.12, maxFireShare: 0.045 },
  newRoles: { hire: 0.05, fire: 0.1, maxFireShare: 0.06 },
  localSector: { hire: 0.07, fire: 0.1, maxFireShare: 0.05 },
  publicSector: { hire: 0.05, fire: 0.06, maxFireShare: 0.03 },
} as const;

const BASE_WAGE_PAYROLL =
  WHITE_COLLAR_BASE_WORKERS * WHITE_COLLAR_BASE_WAGE +
  BASE_SECTORS.retail.workers * BASE_SECTORS.retail.wage +
  BASE_SECTORS.food.workers * BASE_SECTORS.food.wage +
  BASE_SECTORS.housing.workers * BASE_SECTORS.housing.wage +
  BASE_SCHOOL_CLINIC_WORKERS * SCHOOL_CLINIC_WAGE +
  BASE_CITY_HALL_WORKERS * CITY_HALL_WAGE;

const BASE_SUPPORT_PAID =
  (BASE_SHORT_TERM_UNEMPLOYED +
    BASE_LONG_TERM_UNEMPLOYED * LONG_TERM_BENEFIT_RATIO) *
  SUPPORT_PER_PERSON;

const BASE_SPENDING_POWER =
  BASE_WAGE_PAYROLL * MPC_WAGES + BASE_SUPPORT_PAID * MPC_BENEFITS;

export const SIMULATION_SPEEDS: SimulationSpeed[] = [1, 2, 4];

export const SIMULATION_SPEED_INTERVALS: Record<SimulationSpeed, number> = {
  1: 1_200,
  2: 700,
  4: 380,
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function roundCurrency(value: number) {
  return Math.round(value);
}

type EconomyFlows = {
  laborForce: number;
  outMigrants: number;
  employedWorkers: number;
  unemployedWorkers: number;
  unemploymentRate: number;
  slackPoints: number;
  externalDemandFactor: number;
  whiteCollarWage: number;
  whiteCollarRevenue: number;
  whiteCollarPayroll: number;
  whiteCollarProfit: number;
  whiteCollarMargin: number;
  aiLeakageCost: number;
  newRolePayroll: number;
  newRoleRevenue: number;
  sectorFactor: Record<LocalSectorKey, number>;
  sectorRevenue: Record<LocalSectorKey, number>;
  sectorPayroll: Record<LocalSectorKey, number>;
  schoolClinicPayroll: number;
  cityHallPayroll: number;
  wagePayrollTotal: number;
  taxRevenue: number;
  servicePressure: number;
  publicServiceNeed: number;
  publicServiceLevel: number;
  publicServiceCost: number;
  unemploymentSupportNeed: number;
  supportCoverage: number;
  unemploymentSupport: number;
  debtInterest: number;
  fiscalBalance: number;
  householdIncome: number;
  householdSpending: number;
  spendingPowerRatio: number;
  projectedNextDemand: number;
  stability: number;
};

function computeFlows(state: SimulatorState): EconomyFlows {
  const demandRatio = state.demand / 100;
  const adoption = clamp(state.aiAdoption, 0, 1);

  const employedWorkers =
    state.whiteCollarWorkers +
    state.newRoleWorkers +
    state.retailWorkers +
    state.foodWorkers +
    state.housingWorkers +
    state.schoolClinicWorkers +
    state.cityHallWorkers;
  const unemployedWorkers =
    state.shortTermUnemployed + state.longTermUnemployed;
  const laborForce = employedWorkers + unemployedWorkers;
  const outMigrants = Math.max(0, TOTAL_BASE_LABOR_FORCE - laborForce);
  const populationRatio = laborForce / TOTAL_BASE_LABOR_FORCE;
  const unemploymentRate = (unemployedWorkers / laborForce) * 100;
  const slackPoints = unemploymentRate - NATURAL_UNEMPLOYMENT_RATE;

  // White-collar firms sell mostly to outside clients, so their revenue is
  // only mildly coupled to local demand — that is what makes the shock
  // asymmetric: profits can boom while the local economy sags.
  const externalDemandFactor = 0.88 + 0.12 * demandRatio;
  const whiteCollarWage = WHITE_COLLAR_BASE_WAGE * state.wageIndex;
  const whiteCollarRevenue =
    WHITE_COLLAR_BASE_REVENUE *
    externalDemandFactor *
    (1 + AI_OUTPUT_BOOST * adoption);
  const whiteCollarPayroll = state.whiteCollarWorkers * whiteCollarWage;
  const aiLeakageCost = AI_LEAKAGE_MAX * Math.pow(adoption, 1.1);
  const whiteCollarProfit =
    whiteCollarRevenue - whiteCollarPayroll - aiLeakageCost;
  const whiteCollarMargin =
    whiteCollarRevenue === 0 ? 0 : whiteCollarProfit / whiteCollarRevenue;

  const newRolePayroll = state.newRoleWorkers * NEW_ROLE_WAGE * state.wageIndex;
  const newRoleRevenue = state.newRoleWorkers * NEW_ROLE_OUTPUT_PER_WORKER;

  const sectorFactor = {} as Record<LocalSectorKey, number>;
  const sectorRevenue = {} as Record<LocalSectorKey, number>;
  const sectorPayroll = {} as Record<LocalSectorKey, number>;
  for (const key of ["retail", "food", "housing"] as const) {
    const base = BASE_SECTORS[key];
    // Local sectors track local demand, scaled down further if people have
    // left the city entirely.
    sectorFactor[key] =
      clamp(1 + base.demandSensitivity * (demandRatio - 1), 0.3, 1.12) *
      populationRatio;
    sectorRevenue[key] = base.revenue * sectorFactor[key];
  }
  sectorPayroll.retail = state.retailWorkers * BASE_SECTORS.retail.wage;
  sectorPayroll.food = state.foodWorkers * BASE_SECTORS.food.wage;
  sectorPayroll.housing = state.housingWorkers * BASE_SECTORS.housing.wage;

  const schoolClinicPayroll = state.schoolClinicWorkers * SCHOOL_CLINIC_WAGE;
  const cityHallPayroll = state.cityHallWorkers * CITY_HALL_WAGE;
  const wagePayrollTotal =
    whiteCollarPayroll +
    newRolePayroll +
    sectorPayroll.retail +
    sectorPayroll.food +
    sectorPayroll.housing +
    schoolClinicPayroll +
    cityHallPayroll;

  const taxRevenue =
    (sectorRevenue.retail +
      sectorRevenue.food +
      sectorRevenue.housing +
      newRoleRevenue) *
      SALES_TAX_RATE +
    Math.max(0, whiteCollarProfit) * PROFIT_TAX_RATE +
    wagePayrollTotal * PAYROLL_TAX_RATE;

  const servicePressure =
    1 +
    Math.max(0, 100 - state.demand) / 220 +
    unemployedWorkers / laborForce / 5;
  const publicServiceNeed =
    (BASE_SCHOOL_CLINIC_WORKERS * SCHOOL_CLINIC_WAGE +
      BASE_CITY_HALL_WORKERS * CITY_HALL_WAGE +
      BASE_PUBLIC_SERVICE_OPERATIONS) *
    servicePressure;
  const unemploymentSupportNeed = unemployedWorkers * SUPPORT_PER_PERSON;
  // The city can draw down reserves over roughly half a year, not all at once.
  const availableFunds = Math.max(0, state.cityBudget) / 6 + taxRevenue;
  const totalFiscalNeed = publicServiceNeed + unemploymentSupportNeed;
  const fiscalCoverage =
    totalFiscalNeed === 0
      ? 1
      : clamp(availableFunds / totalFiscalNeed, 0, 1.05);
  const publicServiceLevel = clamp(0.4 + 0.6 * fiscalCoverage, 0.35, 1);
  const supportCoverage =
    unemploymentSupportNeed === 0
      ? 1
      : clamp(0.1 + 0.9 * fiscalCoverage, 0.1, 1);
  const unemploymentSupport =
    (state.shortTermUnemployed +
      state.longTermUnemployed * LONG_TERM_BENEFIT_RATIO) *
    SUPPORT_PER_PERSON *
    supportCoverage;
  const publicServiceCost =
    schoolClinicPayroll +
    cityHallPayroll +
    BASE_PUBLIC_SERVICE_OPERATIONS * servicePressure * publicServiceLevel;
  const debtInterest =
    state.cityBudget < 0 ? -state.cityBudget * DEBT_INTEREST_RATE : 0;
  const fiscalBalance =
    taxRevenue - publicServiceCost - unemploymentSupport - debtInterest;

  const householdIncome = wagePayrollTotal + unemploymentSupport;
  const confidenceFactor = 0.7 + 0.3 * state.consumerConfidence;
  const spendingPower =
    (wagePayrollTotal * MPC_WAGES + unemploymentSupport * MPC_BENEFITS) *
    confidenceFactor;
  const spendingPowerRatio = spendingPower / BASE_SPENDING_POWER;
  const householdSpending =
    sectorRevenue.retail + sectorRevenue.food + sectorRevenue.housing;
  const projectedNextDemand = clamp(
    state.demand * 0.45 + 100 * spendingPowerRatio * 0.55,
    25,
    118,
  );

  const businessStress = clamp((0.15 - whiteCollarMargin) * 60, 0, 12);
  const stability = clamp(
    100 -
      Math.max(0, slackPoints) * 2.2 -
      Math.max(0, 100 - state.demand) * 0.35 -
      Math.max(0, -state.cityBudget) / 80_000 -
      (1 - publicServiceLevel) * 30 -
      (1 - supportCoverage) * 20 -
      outMigrants * 0.15 -
      businessStress,
    0,
    100,
  );

  return {
    laborForce,
    outMigrants,
    employedWorkers,
    unemployedWorkers,
    unemploymentRate,
    slackPoints,
    externalDemandFactor,
    whiteCollarWage,
    whiteCollarRevenue,
    whiteCollarPayroll,
    whiteCollarProfit,
    whiteCollarMargin,
    aiLeakageCost,
    newRolePayroll,
    newRoleRevenue,
    sectorFactor,
    sectorRevenue,
    sectorPayroll,
    schoolClinicPayroll,
    cityHallPayroll,
    wagePayrollTotal,
    taxRevenue,
    servicePressure,
    publicServiceNeed,
    publicServiceLevel,
    publicServiceCost,
    unemploymentSupportNeed,
    supportCoverage,
    unemploymentSupport,
    debtInterest,
    fiscalBalance,
    householdIncome,
    householdSpending,
    spendingPowerRatio,
    projectedNextDemand,
    stability,
  };
}

export function createInitialSimulatorState(): SimulatorState {
  return {
    month: 0,
    aiAdoptionTarget: 0,
    aiAdoption: 0,
    demand: 100,
    consumerConfidence: 1,
    wageIndex: 1,
    cityBudget: BASE_CITY_BUDGET,
    whiteCollarWorkers: WHITE_COLLAR_BASE_WORKERS,
    newRoleWorkers: 0,
    retailWorkers: BASE_SECTORS.retail.workers,
    foodWorkers: BASE_SECTORS.food.workers,
    housingWorkers: BASE_SECTORS.housing.workers,
    schoolClinicWorkers: BASE_SCHOOL_CLINIC_WORKERS,
    cityHallWorkers: BASE_CITY_HALL_WORKERS,
    shortTermUnemployed: BASE_SHORT_TERM_UNEMPLOYED,
    longTermUnemployed: BASE_LONG_TERM_UNEMPLOYED,
    isPlaying: false,
    speed: 1,
    selectedNode: "whiteCollar",
  };
}

export function isPersistedSimulatorState(
  value: unknown,
): value is SimulatorState {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<SimulatorState>;
  const numericFields: (keyof SimulatorState)[] = [
    "month",
    "aiAdoptionTarget",
    "aiAdoption",
    "demand",
    "consumerConfidence",
    "wageIndex",
    "cityBudget",
    "whiteCollarWorkers",
    "newRoleWorkers",
    "retailWorkers",
    "foodWorkers",
    "housingWorkers",
    "schoolClinicWorkers",
    "cityHallWorkers",
    "shortTermUnemployed",
    "longTermUnemployed",
  ];

  return (
    numericFields.every(
      (field) =>
        typeof candidate[field] === "number" &&
        Number.isFinite(candidate[field]),
    ) &&
    typeof candidate.isPlaying === "boolean" &&
    (candidate.speed === 1 || candidate.speed === 2 || candidate.speed === 4) &&
    typeof candidate.selectedNode === "string" &&
    MAP_NODE_KEYS.includes(candidate.selectedNode as MapNodeKey)
  );
}

export function getEconomySnapshot(state: SimulatorState): EconomySnapshot {
  const flows = computeFlows(state);
  const unemployedWorkers = Math.round(flows.unemployedWorkers);

  return {
    month: state.month,
    aiAdoption: clamp(state.aiAdoption, 0, 1),
    aiAdoptionTarget: clamp(state.aiAdoptionTarget, 0, 1),
    demand: state.demand,
    projectedNextDemand: flows.projectedNextDemand,
    stability: flows.stability,
    laborForce: Math.round(flows.laborForce),
    outMigrants: Math.round(flows.outMigrants),
    consumerConfidence: state.consumerConfidence,
    wageIndex: state.wageIndex,
    whiteCollarWage: roundCurrency(flows.whiteCollarWage),
    householdIncome: roundCurrency(flows.householdIncome),
    householdSpending: roundCurrency(flows.householdSpending),
    cityBudget: roundCurrency(state.cityBudget),
    taxRevenue: roundCurrency(flows.taxRevenue),
    fiscalBalance: roundCurrency(flows.fiscalBalance),
    debtInterest: roundCurrency(flows.debtInterest),
    whiteCollarRevenue: roundCurrency(flows.whiteCollarRevenue),
    whiteCollarPayroll: roundCurrency(flows.whiteCollarPayroll),
    whiteCollarProfit: roundCurrency(flows.whiteCollarProfit),
    whiteCollarWorkers: Math.round(state.whiteCollarWorkers),
    newRoleWorkers: Math.round(state.newRoleWorkers),
    newRolePayroll: roundCurrency(flows.newRolePayroll),
    outsideRevenue: roundCurrency(
      flows.whiteCollarRevenue * (0.7 + 0.1 * state.aiAdoption),
    ),
    aiLeakageCost: roundCurrency(flows.aiLeakageCost),
    publicServiceNeed: roundCurrency(flows.publicServiceNeed),
    publicServiceCost: roundCurrency(flows.publicServiceCost),
    publicServiceLevel: flows.publicServiceLevel,
    unemploymentSupportNeed: roundCurrency(flows.unemploymentSupportNeed),
    unemploymentSupport: roundCurrency(flows.unemploymentSupport),
    supportCoverage: flows.supportCoverage,
    unemploymentWorkers: unemployedWorkers,
    shortTermUnemployed: Math.round(state.shortTermUnemployed),
    longTermUnemployed: Math.round(state.longTermUnemployed),
    longTermShare:
      flows.unemployedWorkers === 0
        ? 0
        : state.longTermUnemployed / flows.unemployedWorkers,
    unemploymentRate: flows.unemploymentRate,
    employedWorkers: Math.round(flows.employedWorkers),
    sectorRevenue: {
      retail: roundCurrency(flows.sectorRevenue.retail),
      food: roundCurrency(flows.sectorRevenue.food),
      housing: roundCurrency(flows.sectorRevenue.housing),
    },
    sectorWorkers: {
      retail: Math.round(state.retailWorkers),
      food: Math.round(state.foodWorkers),
      housing: Math.round(state.housingWorkers),
      schoolClinic: Math.round(state.schoolClinicWorkers),
      cityHall: Math.round(state.cityHallWorkers),
    },
    sectorPayroll: {
      retail: roundCurrency(flows.sectorPayroll.retail),
      food: roundCurrency(flows.sectorPayroll.food),
      housing: roundCurrency(flows.sectorPayroll.housing),
      schoolClinic: roundCurrency(flows.schoolClinicPayroll),
      cityHall: roundCurrency(flows.cityHallPayroll),
    },
    collapseRisk: {
      stability: flows.stability < 30,
      unemployment: flows.unemploymentRate > 18,
      budget: state.cityBudget < 0,
      services: flows.publicServiceLevel < 0.7,
      support: flows.supportCoverage < 0.65,
      exodus: flows.outMigrants > 60,
    },
  };
}

function adjustWorkforce(
  current: number,
  target: number,
  speeds: { hire: number; fire: number; maxFireShare: number },
) {
  if (target >= current) {
    return current + (target - current) * speeds.hire;
  }

  const cut = Math.min(
    (current - target) * speeds.fire,
    current * speeds.maxFireShare,
  );
  return current - cut;
}

export function simulateMonth(state: SimulatorState): SimulatorState {
  // 1. AI adoption diffuses toward the target. Roll-outs take months of
  // procurement and integration; unwinding embedded automation is even slower.
  const adoptionGap = clamp(state.aiAdoptionTarget, 0, 1) - state.aiAdoption;
  const aiAdoption = clamp(
    state.aiAdoption +
      adoptionGap * (adoptionGap >= 0 ? AI_ADOPTION_RAMP_UP : AI_ADOPTION_RAMP_DOWN),
    0,
    1,
  );

  const working: SimulatorState = { ...state, aiAdoption };
  const flows = computeFlows(working);
  const demandRatio = state.demand / 100;
  const populationRatio = flows.laborForce / TOTAL_BASE_LABOR_FORCE;

  // 2. Where each part of the economy wants its headcount to be.
  const whiteCollarTarget =
    WHITE_COLLAR_BASE_WORKERS *
    flows.externalDemandFactor *
    (1 + AI_OUTPUT_BOOST * aiAdoption) *
    (1 - AI_TASK_DISPLACEMENT * Math.pow(aiAdoption, 1.15));
  const marginHealth = clamp(flows.whiteCollarMargin / 0.4, 0, 1);
  const newRoleTarget =
    WHITE_COLLAR_BASE_WORKERS *
    NEW_ROLE_SHARE *
    aiAdoption *
    clamp(0.4 + 0.6 * demandRatio, 0.3, 1.1) *
    clamp(0.5 + 0.5 * marginHealth, 0.4, 1);
  const retailTarget = BASE_SECTORS.retail.workers * flows.sectorFactor.retail;
  const foodTarget = BASE_SECTORS.food.workers * flows.sectorFactor.food;
  const housingTarget =
    BASE_SECTORS.housing.workers * flows.sectorFactor.housing;
  const schoolClinicTarget = Math.max(
    15,
    BASE_SCHOOL_CLINIC_WORKERS * flows.publicServiceLevel * populationRatio,
  );
  const cityHallTarget = Math.max(
    18,
    BASE_CITY_HALL_WORKERS *
      (0.7 + 0.3 * flows.publicServiceLevel) *
      populationRatio,
  );

  // 3. Stocks move toward targets at realistic hiring/layoff speeds.
  const desired = {
    whiteCollarWorkers: adjustWorkforce(
      state.whiteCollarWorkers,
      whiteCollarTarget,
      ADJUSTMENT_SPEEDS.whiteCollar,
    ),
    newRoleWorkers: adjustWorkforce(
      state.newRoleWorkers,
      newRoleTarget,
      ADJUSTMENT_SPEEDS.newRoles,
    ),
    retailWorkers: adjustWorkforce(
      state.retailWorkers,
      retailTarget,
      ADJUSTMENT_SPEEDS.localSector,
    ),
    foodWorkers: adjustWorkforce(
      state.foodWorkers,
      foodTarget,
      ADJUSTMENT_SPEEDS.localSector,
    ),
    housingWorkers: adjustWorkforce(
      state.housingWorkers,
      housingTarget,
      ADJUSTMENT_SPEEDS.localSector,
    ),
    schoolClinicWorkers: adjustWorkforce(
      state.schoolClinicWorkers,
      schoolClinicTarget,
      ADJUSTMENT_SPEEDS.publicSector,
    ),
    cityHallWorkers: adjustWorkforce(
      state.cityHallWorkers,
      cityHallTarget,
      ADJUSTMENT_SPEEDS.publicSector,
    ),
  };

  // 4. Net expansion hiring is limited by how many unemployed can actually be
  // matched to openings this month (long-term unemployed match at a discount).
  const stockKeys = Object.keys(desired) as (keyof typeof desired)[];
  let desiredNetHires = 0;
  for (const key of stockKeys) {
    desiredNetHires += Math.max(0, desired[key] - state[key]);
  }
  const matchableWorkers =
    (state.shortTermUnemployed +
      state.longTermUnemployed * LONG_TERM_MATCH_PENALTY) *
    MONTHLY_MATCHING_EFFICIENCY;
  const hireScale =
    desiredNetHires > matchableWorkers && desiredNetHires > 0
      ? matchableWorkers / desiredNetHires
      : 1;

  const nextStocks = {} as Record<keyof typeof desired, number>;
  let netHires = 0;
  let netSeparations = 0;
  for (const key of stockKeys) {
    const delta = desired[key] - state[key];
    nextStocks[key] = state[key] + (delta > 0 ? delta * hireScale : delta);
    if (delta > 0) {
      netHires += delta * hireScale;
    } else {
      netSeparations += -delta;
    }
  }

  // 5. Unemployment pool accounting: regular churn keeps people cycling
  // through short spells even in a healthy month; net layoffs add to the pool.
  const churn = flows.employedWorkers * MONTHLY_CHURN_RATE;
  const grossHires = netHires + churn;
  const grossSeparations = netSeparations + churn;

  let shortTermUnemployed = state.shortTermUnemployed + grossSeparations;
  let longTermUnemployed = state.longTermUnemployed;
  const longTermWeight =
    longTermUnemployed * LONG_TERM_MATCH_PENALTY /
    Math.max(1e-9, shortTermUnemployed + longTermUnemployed * LONG_TERM_MATCH_PENALTY);
  let hiresFromLong = Math.min(longTermUnemployed, grossHires * longTermWeight);
  let hiresFromShort = Math.min(
    shortTermUnemployed,
    grossHires - hiresFromLong,
  );
  hiresFromLong = Math.min(
    longTermUnemployed,
    hiresFromLong + (grossHires - hiresFromLong - hiresFromShort),
  );
  shortTermUnemployed -= hiresFromShort;
  longTermUnemployed -= hiresFromLong;

  // 6. Spells age into long-term unemployment; the long-term unemployed start
  // leaving the city when slack stays high and the safety net frays.
  const agingFlow = shortTermUnemployed * SHORT_TO_LONG_TERM_RATE;
  shortTermUnemployed -= agingFlow;
  longTermUnemployed += agingFlow;
  const leaveRate = clamp(
    0.003 * Math.max(0, flows.slackPoints) +
      0.04 * (1 - flows.supportCoverage) +
      0.025 * (1 - flows.publicServiceLevel),
    0,
    0.08,
  );
  longTermUnemployed -= longTermUnemployed * leaveRate;

  // 7. Wages respond to slack: erosion when unemployment is high, modest
  // gains for the workers who remain when AI lifts their productivity.
  const wageIndex = clamp(
    state.wageIndex - 0.0012 * flows.slackPoints + 0.0022 * aiAdoption,
    0.75,
    1.12,
  );

  // 8. Confidence follows the labor market and the safety net with a lag.
  const confidenceTarget = clamp(
    1 -
      0.02 * flows.slackPoints -
      0.22 * (1 - flows.supportCoverage) -
      0.18 * (1 - flows.publicServiceLevel),
    0.45,
    1.06,
  );
  const consumerConfidence =
    state.consumerConfidence +
    (confidenceTarget - state.consumerConfidence) * 0.22;

  return {
    ...state,
    month: state.month + 1,
    aiAdoption,
    demand: flows.projectedNextDemand,
    consumerConfidence,
    wageIndex,
    cityBudget: state.cityBudget + flows.fiscalBalance,
    ...nextStocks,
    shortTermUnemployed: Math.max(0, shortTermUnemployed),
    longTermUnemployed: Math.max(0, longTermUnemployed),
  };
}

export function getCollapseWarnings(snapshot: EconomySnapshot) {
  const warnings: string[] = [];

  if (snapshot.collapseRisk.stability) {
    warnings.push("Stability below 30. The city is entering a civic crisis.");
  }

  if (snapshot.collapseRisk.unemployment) {
    warnings.push(
      "Unemployment above 18%. Households are falling out of the local economy.",
    );
  }

  if (snapshot.collapseRisk.budget) {
    warnings.push(
      "City budget is negative. Interest on the shortfall is now eating into services.",
    );
  }

  if (snapshot.collapseRisk.services) {
    warnings.push(
      "Public services are being rationed. Clinics, schools, and permitting capacity are thinning out.",
    );
  }

  if (snapshot.collapseRisk.support) {
    warnings.push(
      "Unemployment support is no longer covering most displaced workers.",
    );
  }

  if (snapshot.collapseRisk.exodus) {
    warnings.push(
      "Workers are leaving the city. Every departure shrinks local demand and the tax base.",
    );
  }

  return warnings;
}

export function getSpeedLabel(speed: SimulationSpeed) {
  return `${speed}x`;
}

export function getStabilityTone(stability: number) {
  if (stability < 30) return "critical";
  if (stability < 60) return "warning";
  return "stable";
}

export const SIMULATION_BASELINES = {
  totalWorkforce: TOTAL_BASE_LABOR_FORCE,
  whiteCollarWorkers: WHITE_COLLAR_BASE_WORKERS,
  naturalUnemploymentRate: NATURAL_UNEMPLOYMENT_RATE,
};
