import { describe, expect, it } from "vitest";
import { AI_ACCEPTABILITY_QUESTIONS } from "../src/components/tools/AIAcceptability/questions";
import {
  COMPASS_THRESHOLD,
  scoreQuiz,
} from "../src/components/tools/AIAcceptability/scoring";
import type {
  QuizAnswers,
  QuizQuestion,
} from "../src/components/tools/AIAcceptability/types";

const answersFor = (answer: (question: QuizQuestion) => QuizAnswers[string]) =>
  Object.fromEntries(
    AI_ACCEPTABILITY_QUESTIONS.map((question) => [
      question.id,
      answer(question),
    ]),
  );

const thresholdQuestions = (questionsPerAgency: number): QuizQuestion[] =>
  Array.from({ length: questionsPerAgency * 2 }, (_, index) => ({
    id: "threshold-" + index,
    category: "everyday",
    agency: index < questionsPerAgency ? "assist" : "delegate",
    prompt: "Threshold question",
    context: "Used to test the visualization boundary.",
    yesChallenge: "A synthetic challenge to an initial Yes answer.",
    noChallenge: "A synthetic challenge to an initial No answer.",
  }));

describe("AI acceptability scoring", () => {
  it("keeps the authored quiz balanced across assistance and delegation", () => {
    const assistCount = AI_ACCEPTABILITY_QUESTIONS.filter(
      (question) => question.agency === "assist",
    ).length;
    const delegateCount = AI_ACCEPTABILITY_QUESTIONS.filter(
      (question) => question.agency === "delegate",
    ).length;

    const categoryCount = new Set(
      AI_ACCEPTABILITY_QUESTIONS.map((question) => question.category),
    ).size;

    expect(AI_ACCEPTABILITY_QUESTIONS).toHaveLength(30);
    expect(assistCount).toBe(15);
    expect(delegateCount).toBe(15);
    expect(categoryCount).toBe(10);
  });

  it("pressure-tests both an initial Yes and an initial No for every question", () => {
    for (const question of AI_ACCEPTABILITY_QUESTIONS) {
      expect(question.yesChallenge.trim().length).toBeGreaterThan(30);
      expect(question.noChallenge.trim().length).toBeGreaterThan(30);
      expect(question.yesChallenge.startsWith("What about")).toBe(true);
      expect(question.noChallenge.startsWith("What about")).toBe(true);
      expect(question.yesChallenge).not.toBe(question.noChallenge);
    }
  });

  it("uses a spectrum when acceptance is one-dimensional", () => {
    const result = scoreQuiz(
      AI_ACCEPTABILITY_QUESTIONS,
      answersFor(() => "yes"),
    );

    expect(result).toMatchObject({
      acceptance: 100,
      oversightDelta: 0,
      visualization: "spectrum",
      archetype: "AI maximalist",
      summary: "You accept AI across every scenario in this quiz.",
    });
  });

  it("uses a compass when assistance and delegation diverge", () => {
    const result = scoreQuiz(
      AI_ACCEPTABILITY_QUESTIONS,
      answersFor((question) => (question.agency === "assist" ? "yes" : "no")),
    );

    expect(result).toMatchObject({
      acceptance: 50,
      oversight: 100,
      oversightDelta: 100,
      visualization: "compass",
      archetype: "Cautious pragmatist",
    });
  });

  it("switches visualization only after the materiality threshold", () => {
    const belowThresholdQuestions = thresholdQuestions(6);
    const belowThresholdAnswers: QuizAnswers = Object.fromEntries(
      belowThresholdQuestions.map((question, index) => [
        question.id,
        index === 0 ? "yes" : index === 6 ? "no" : "maybe",
      ]),
    );
    const atThresholdQuestions = thresholdQuestions(5);
    const atThresholdAnswers: QuizAnswers = Object.fromEntries(
      atThresholdQuestions.map((question, index) => [
        question.id,
        index === 0 ? "yes" : index === 5 ? "no" : "maybe",
      ]),
    );

    const below = scoreQuiz(belowThresholdQuestions, belowThresholdAnswers);
    const atOrAbove = scoreQuiz(atThresholdQuestions, atThresholdAnswers);

    expect(COMPASS_THRESHOLD).toBe(18);
    expect(below.oversightDelta).toBe(17);
    expect(below.visualization).toBe("spectrum");
    expect(atOrAbove.oversightDelta).toBe(20);
    expect(atOrAbove.visualization).toBe("compass");
  });

  it("refuses to score incomplete answers", () => {
    expect(() => scoreQuiz(AI_ACCEPTABILITY_QUESTIONS, {})).toThrow(
      'Missing answer for question "trip-plan".',
    );
  });
});
