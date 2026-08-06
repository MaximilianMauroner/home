import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import Deskbot from "./Deskbot";
import { AI_ACCEPTABILITY_QUESTIONS, CATEGORY_LABELS } from "./questions";
import { scoreQuiz } from "./scoring";
import type { QuizAnswer, QuizAnswers, QuizResult } from "./types";
import "./ai-acceptability.css";

const ANSWER_OPTIONS = [
  { value: "yes", label: "Yes" },
  { value: "maybe", label: "Maybe" },
  { value: "no", label: "No" },
] as const satisfies readonly {
  value: QuizAnswer;
  label: string;
}[];

const scrollPanelIntoView = () => {
  requestAnimationFrame(() => {
    document
      .querySelector(".ai-quiz__panel")
      ?.scrollIntoView({ block: "start" });
  });
};

const ANSWER_EYE_COLORS: Record<QuizAnswer, string> = {
  yes: "#a8ddff",
  maybe: "#ff9b45",
  no: "#ff1515",
};

const mixChannel = (start: number, end: number, progress: number) =>
  Math.round(start + (end - start) * progress);

const eyeColorForProgress = (progress: number) => {
  const clamped = Math.min(Math.max(progress, 0), 1);
  const start = clamped < 0.5 ? [168, 221, 255] : [246, 204, 76];
  const end = clamped < 0.5 ? [246, 204, 76] : [255, 21, 21];
  const localProgress = clamped < 0.5 ? clamped * 2 : (clamped - 0.5) * 2;

  return `rgb(${mixChannel(start[0], end[0], localProgress)} ${mixChannel(
    start[1],
    end[1],
    localProgress,
  )} ${mixChannel(start[2], end[2], localProgress)})`;
};

function SpectrumResult({ result }: { result: QuizResult }) {
  const archetypes = [
    "Refuser",
    "Sceptic",
    "Realist",
    "Optimist",
    "Maximalist",
  ];
  const markerPosition = Math.min(Math.max(result.acceptance, 2), 98);

  return (
    <div className="ai-spectrum" aria-label="AI acceptance spectrum">
      <div className="ai-spectrum__bar" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
        <span />
        <i style={{ left: markerPosition + "%" }} />
      </div>
      <div className="ai-spectrum__labels" aria-hidden="true">
        {archetypes.map((archetype) => (
          <span key={archetype}>{archetype}</span>
        ))}
      </div>
      <p className="ai-result__metric">
        <strong>{result.acceptance}%</strong>
        overall acceptance
      </p>
    </div>
  );
}

function CompassResult({ result }: { result: QuizResult }) {
  const horizontalPosition = Math.min(Math.max(result.acceptance, 2), 98);
  const verticalPosition = Math.min(Math.max(100 - result.oversight, 2), 98);

  return (
    <div className="ai-compass-layout">
      <div
        className="ai-compass"
        aria-label="AI acceptance and oversight compass"
      >
        <span className="ai-compass__axis ai-compass__axis--top">
          Human oversight
        </span>
        <span className="ai-compass__axis ai-compass__axis--bottom">
          AI autonomy
        </span>
        <span className="ai-compass__axis ai-compass__axis--left">
          Narrow use
        </span>
        <span className="ai-compass__axis ai-compass__axis--right">
          Broad use
        </span>
        <span className="ai-compass__quadrant ai-compass__quadrant--one">
          Sceptic
        </span>
        <span className="ai-compass__quadrant ai-compass__quadrant--two">
          Pragmatist
        </span>
        <span className="ai-compass__quadrant ai-compass__quadrant--three">
          Refuser
        </span>
        <span className="ai-compass__quadrant ai-compass__quadrant--four">
          Accelerationist
        </span>
        <span
          className="ai-compass__marker"
          style={{
            left: horizontalPosition + "%",
            top: verticalPosition + "%",
          }}
        >
          <span>You</span>
        </span>
      </div>
      <div className="ai-compass-metrics">
        <p className="ai-result__metric">
          <strong>{result.acceptance}%</strong>
          breadth of acceptance
        </p>
        <p className="ai-result__metric">
          <strong>{Math.abs(result.oversightDelta)} pts</strong>
          {result.oversightDelta >= 0
            ? "more open to assistance"
            : "more open to autonomy"}
        </p>
      </div>
    </div>
  );
}

export default function AIAcceptability() {
  const [answers, setAnswers] = useState<QuizAnswers>({});
  const [questionIndex, setQuestionIndex] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [copyLabel, setCopyLabel] = useState("Copy result");
  const [pendingAnswer, setPendingAnswer] = useState<QuizAnswer>();
  const [isWaiting, setIsWaiting] = useState(false);
  const questionRef = useRef<HTMLDivElement>(null);
  const answerTimerRef = useRef<number>();

  const question = AI_ACCEPTABILITY_QUESTIONS[questionIndex];
  const selectedAnswer = question ? answers[question.id] : undefined;
  const progress = isComplete
    ? 100
    : Math.round(
        ((questionIndex + 1) / AI_ACCEPTABILITY_QUESTIONS.length) * 100,
      );
  const result = useMemo(
    () =>
      isComplete ? scoreQuiz(AI_ACCEPTABILITY_QUESTIONS, answers) : undefined,
    [answers, isComplete],
  );

  useEffect(() => {
    questionRef.current?.style.setProperty("--deskbot-eye", "#a8ddff");
  }, [isComplete, questionIndex]);

  useEffect(() => {
    setIsWaiting(false);
    if (isComplete || pendingAnswer) return;

    const waitingTimer = window.setTimeout(() => setIsWaiting(true), 9_000);
    return () => window.clearTimeout(waitingTimer);
  }, [isComplete, pendingAnswer, questionIndex]);

  useEffect(
    () => () => {
      window.clearTimeout(answerTimerRef.current);
    },
    [],
  );

  const commitAnswer = (answer: QuizAnswer) => {
    setAnswers((previous) => ({ ...previous, [question.id]: answer }));

    if (questionIndex === AI_ACCEPTABILITY_QUESTIONS.length - 1) {
      setIsComplete(true);
      scrollPanelIntoView();
      return;
    }

    setQuestionIndex((previous) => previous + 1);
  };

  const answerQuestion = (answer: QuizAnswer) => {
    if (pendingAnswer) {
      window.clearTimeout(answerTimerRef.current);
      commitAnswer(pendingAnswer);
      setPendingAnswer(undefined);
      return;
    }

    setPendingAnswer(answer);
    setIsWaiting(false);
    questionRef.current?.style.setProperty(
      "--deskbot-eye",
      ANSWER_EYE_COLORS[answer],
    );
    answerTimerRef.current = window.setTimeout(() => {
      commitAnswer(answer);
      setPendingAnswer(undefined);
    }, 650);
  };

  const cancelPendingAnswer = () => {
    window.clearTimeout(answerTimerRef.current);
    setPendingAnswer(undefined);
  };

  const goBack = () => {
    cancelPendingAnswer();
    if (isComplete) {
      setIsComplete(false);
      setQuestionIndex(AI_ACCEPTABILITY_QUESTIONS.length - 1);
      scrollPanelIntoView();
      return;
    }
    setQuestionIndex((previous) => Math.max(previous - 1, 0));
  };

  const restart = () => {
    cancelPendingAnswer();
    setAnswers({});
    setQuestionIndex(0);
    setIsComplete(false);
    setCopyLabel("Copy result");
    scrollPanelIntoView();
  };

  const previewAnswerProximity = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (pendingAnswer) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const progress = (event.clientX - bounds.left) / bounds.width;
    questionRef.current?.style.setProperty(
      "--deskbot-eye",
      eyeColorForProgress(progress),
    );
  };

  const resetAnswerPreview = () => {
    if (!pendingAnswer) {
      questionRef.current?.style.setProperty("--deskbot-eye", "#a8ddff");
    }
  };

  const copyResult = async () => {
    if (!result) return;

    const text =
      "My AI stance: " +
      result.archetype +
      " (" +
      result.acceptance +
      "% acceptance). " +
      result.summary;
    try {
      await navigator.clipboard.writeText(text);
      setCopyLabel("Copied");
    } catch {
      setCopyLabel("Copy failed");
    }
  };

  return (
    <div className="ai-quiz">
      <header className="ai-quiz__header">
        <div>
          <p className="ai-eyebrow">AI acceptability test</p>
          <h1>Where do you draw the line?</h1>
        </div>
        <p className="ai-quiz__intro">
          {AI_ACCEPTABILITY_QUESTIONS.length} concrete scenarios. No correct
          answers. Nothing leaves your browser.
        </p>
      </header>

      <section className="ai-quiz__panel" aria-live="polite">
        <div className="ai-progress-row">
          <span>{isComplete ? "Result" : "AI compass"}</span>
          <span>
            {isComplete
              ? "Complete"
              : questionIndex + 1 + " / " + AI_ACCEPTABILITY_QUESTIONS.length}
          </span>
        </div>
        <div
          className="ai-progress"
          role="progressbar"
          aria-label="Quiz progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
        >
          <span style={{ width: progress + "%" }} />
        </div>

        {!result && question ? (
          <div className="ai-question" ref={questionRef}>
            <div className="ai-question__lead">
              <p className="ai-question__category">
                {CATEGORY_LABELS[question.category]} ·{" "}
                {question.agency === "assist" ? "AI assists" : "AI acts"}
              </p>
              <h2>{question.prompt}</h2>
              <p className="ai-question__context">{question.context}</p>
              <Deskbot
                mood={pendingAnswer ?? (isWaiting ? "waiting" : "idle")}
              />
            </div>

            <div className="ai-counter-grid">
              <div className="ai-counter-case ai-counter-case--yes">
                <strong>If yes, what about this?</strong>
                <p>{question.yesChallenge}</p>
              </div>
              <div className="ai-counter-case ai-counter-case--no">
                <strong>If no, what about this?</strong>
                <p>{question.noChallenge}</p>
              </div>
            </div>

            <div
              className="ai-answer-grid"
              aria-label="Choose an answer"
              onPointerMove={previewAnswerProximity}
              onPointerLeave={resetAnswerPreview}
            >
              {ANSWER_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={"ai-answer ai-answer--" + option.value}
                  aria-pressed={
                    (pendingAnswer ?? selectedAnswer) === option.value
                  }
                  onPointerEnter={() =>
                    !pendingAnswer &&
                    questionRef.current?.style.setProperty(
                      "--deskbot-eye",
                      ANSWER_EYE_COLORS[option.value],
                    )
                  }
                  onFocus={() =>
                    !pendingAnswer &&
                    questionRef.current?.style.setProperty(
                      "--deskbot-eye",
                      ANSWER_EYE_COLORS[option.value],
                    )
                  }
                  onBlur={resetAnswerPreview}
                  onClick={() => answerQuestion(option.value)}
                >
                  <span>{option.label}</span>
                </button>
              ))}
            </div>

            <div className="ai-question__footer">
              <button
                type="button"
                className="ai-text-button"
                onClick={goBack}
                disabled={questionIndex === 0}
              >
                ← Previous
              </button>
              <span>Your answer advances automatically</span>
            </div>
          </div>
        ) : null}

        {result ? (
          <div className="ai-result">
            <div className="ai-result__heading">
              <div>
                <p className="ai-eyebrow">Your stance</p>
                <h2>{result.archetype}</h2>
              </div>
              <p>{result.summary}</p>
            </div>

            {result.visualization === "compass" ? (
              <CompassResult result={result} />
            ) : (
              <SpectrumResult result={result} />
            )}

            <div className="ai-category-section">
              <div className="ai-category-section__header">
                <h3>Your boundaries</h3>
                <span>0 = no · 100 = yes</span>
              </div>
              <div className="ai-category-grid">
                {result.categoryScores.map(({ category, score }) => (
                  <div className="ai-category" key={category}>
                    <div>
                      <span>{CATEGORY_LABELS[category]}</span>
                      <strong>{score}</strong>
                    </div>
                    <div className="ai-category__track" aria-hidden="true">
                      <span style={{ width: score + "%" }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="ai-result__actions">
              <button type="button" className="ai-action" onClick={copyResult}>
                {copyLabel}
              </button>
              <button
                type="button"
                className="ai-action ai-action--secondary"
                onClick={restart}
              >
                Retake test
              </button>
              <button type="button" className="ai-text-button" onClick={goBack}>
                ← Change last answer
              </button>
            </div>
            <p className="ai-disclaimer">
              This result describes your answers to this quiz. It is not a
              scientific or psychological assessment.
            </p>
          </div>
        ) : null}
      </section>
    </div>
  );
}
