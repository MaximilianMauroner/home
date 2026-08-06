export type QuizAnswer = "yes" | "maybe" | "no";

export type QuestionAgency = "assist" | "delegate";

export type QuestionCategory =
  | "everyday"
  | "creative"
  | "personal"
  | "education"
  | "work"
  | "civic"
  | "media"
  | "money"
  | "conflict"
  | "high-stakes";

export interface QuizQuestion {
  id: string;
  category: QuestionCategory;
  agency: QuestionAgency;
  prompt: string;
  context: string;
  yesChallenge: string;
  noChallenge: string;
}

export type QuizAnswers = Record<string, QuizAnswer>;

export type ResultVisualization = "compass" | "spectrum";

export interface CategoryScore {
  category: QuestionCategory;
  score: number;
}

export interface QuizResult {
  acceptance: number;
  oversight: number;
  oversightDelta: number;
  visualization: ResultVisualization;
  archetype: string;
  summary: string;
  categoryScores: CategoryScore[];
}
