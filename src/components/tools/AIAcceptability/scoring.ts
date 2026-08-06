import { CATEGORY_LABELS } from "./questions";
import type {
  CategoryScore,
  QuestionCategory,
  QuizAnswer,
  QuizAnswers,
  QuizQuestion,
  QuizResult,
} from "./types";

export const COMPASS_THRESHOLD = 18;

const ANSWER_VALUES: Record<QuizAnswer, number> = {
  no: 0,
  maybe: 50,
  yes: 100,
};

const average = (values: number[]) =>
  values.reduce((total, value) => total + value, 0) / values.length;

const roundedAverage = (values: number[]) => Math.round(average(values));

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(Math.max(value, minimum), maximum);

function getSpectrumArchetype(acceptance: number) {
  if (acceptance < 20) return "AI refuser";
  if (acceptance < 40) return "AI sceptic";
  if (acceptance < 60) return "AI realist";
  if (acceptance < 80) return "AI optimist";
  return "AI maximalist";
}

function getCompassArchetype(acceptance: number, oversightDelta: number) {
  const acceptsBroadly = acceptance >= 50;
  const requiresMoreOversight = oversightDelta >= 0;

  if (!acceptsBroadly && requiresMoreOversight) return "AI sceptic";
  if (acceptsBroadly && requiresMoreOversight) return "Cautious pragmatist";
  if (!acceptsBroadly) return "Selective refuser";
  return "Automation optimist";
}

function getSummary(
  visualization: QuizResult["visualization"],
  acceptance: number,
  oversightDelta: number,
  strongestBoundary: CategoryScore,
) {
  const boundary = CATEGORY_LABELS[strongestBoundary.category].toLowerCase();

  if (acceptance === 0) {
    return "You reject AI across every scenario in this quiz.";
  }

  if (acceptance === 100) {
    return "You accept AI across every scenario in this quiz.";
  }

  if (visualization === "compass" && oversightDelta > 0) {
    return `You are more open to AI assisting people than replacing their judgement. Your clearest boundary is in ${boundary} uses.`;
  }

  if (visualization === "compass") {
    return `You are more comfortable with AI acting independently than merely assisting in some contexts. Your lowest acceptance is in ${boundary} uses.`;
  }

  if (acceptance < 40) {
    return `You draw the line early across most uses of AI, especially in ${boundary} contexts.`;
  }

  if (acceptance < 70) {
    return `You judge AI case by case rather than accepting or rejecting it wholesale. Your clearest boundary is in ${boundary} uses.`;
  }

  return `You accept AI across most of the scenarios, with your strongest reservations in ${boundary} uses.`;
}

export function scoreQuiz(
  questions: readonly QuizQuestion[],
  answers: QuizAnswers,
): QuizResult {
  if (questions.length === 0) {
    throw new Error("Cannot score an empty quiz.");
  }

  const answeredQuestions = questions.map((question) => {
    const answer = answers[question.id];
    if (!answer) {
      throw new Error(`Missing answer for question "${question.id}".`);
    }
    return { question, value: ANSWER_VALUES[answer] };
  });

  const assistValues = answeredQuestions
    .filter(({ question }) => question.agency === "assist")
    .map(({ value }) => value);
  const delegateValues = answeredQuestions
    .filter(({ question }) => question.agency === "delegate")
    .map(({ value }) => value);

  if (assistValues.length === 0 || delegateValues.length === 0) {
    throw new Error("Quiz requires both assist and delegate questions.");
  }

  const acceptance = roundedAverage(
    answeredQuestions.map(({ value }) => value),
  );
  const oversightDelta = Math.round(
    average(assistValues) - average(delegateValues),
  );
  const oversight = Math.round(clamp(50 + oversightDelta / 2, 0, 100));
  const visualization =
    Math.abs(oversightDelta) >= COMPASS_THRESHOLD ? "compass" : "spectrum";

  const categories = Array.from(
    new Set(questions.map((question) => question.category)),
  );
  const categoryScores = categories
    .map((category): CategoryScore => {
      const values = answeredQuestions
        .filter(({ question }) => question.category === category)
        .map(({ value }) => value);
      return {
        category: category as QuestionCategory,
        score: roundedAverage(values),
      };
    })
    .sort((first, second) => first.score - second.score);

  const strongestBoundary = categoryScores[0];
  const archetype =
    visualization === "compass"
      ? getCompassArchetype(acceptance, oversightDelta)
      : getSpectrumArchetype(acceptance);

  return {
    acceptance,
    oversight,
    oversightDelta,
    visualization,
    archetype,
    summary: getSummary(
      visualization,
      acceptance,
      oversightDelta,
      strongestBoundary,
    ),
    categoryScores,
  };
}
