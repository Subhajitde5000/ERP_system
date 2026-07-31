import { CheckCircle2 } from "lucide-react";

import { cn } from "@/lib/utils";
import type { ExamSection, Question } from "@/types/examination";

/**
 * Question paper renderer — shared by the Teacher's editor and the read-only
 * views (PAGE 21). `revealAnswers` is the single switch that decides whether
 * the answer key is drawn; the *data* is filtered server-side for roles that
 * must never receive it.
 */
export function QuestionItems({
  questions,
  sections,
  revealAnswers,
  action,
}: {
  questions: Question[];
  sections?: ExamSection[];
  revealAnswers: boolean;
  /** Per-question controls, rendered by the editor only */
  action?: (question: Question, index: number) => React.ReactNode;
}) {
  // Numbering runs across the whole paper, not per section, so it matches
  // what the student sees. Computed up-front — mutating a counter during
  // render breaks on re-render.
  const numberOf = new Map(questions.map((q, i) => [q.id, i + 1]));

  // Group under section headings when the exam defines them (DB §7.2)
  const grouped = sections?.length
    ? sections.map((s) => ({
        section: s,
        items: questions.filter((q) => q.sectionId === s.id),
      }))
    : [{ section: null, items: questions }];

  return (
    <div className="min-w-0">
      {grouped.map(({ section, items }) => {
        if (!items.length) return null;

        return (
          <section key={section?.id ?? "all"} className="min-w-0">
            {section && (
              <div className="mt-4 border-t border-border pt-4 first:mt-0 first:border-0 first:pt-0">
                <h3 className="flex min-w-0 flex-wrap items-baseline justify-between gap-2 font-display text-[13px] font-bold text-foreground">
                  <span className="min-w-0">{section.title}</span>
                  <span className="shrink-0 text-[11px] font-medium text-muted-foreground">
                    {section.maxMarks} marks
                  </span>
                </h3>
                {section.description && (
                  <p className="mt-0.5 text-[12px] text-muted-foreground">
                    {section.description}
                  </p>
                )}
              </div>
            )}

            <ol className="min-w-0 divide-y divide-border border-t border-border">
              {items.map((q) => {
                const index = numberOf.get(q.id) ?? 0;

                return (
                  <li key={q.id} className="min-w-0 py-4">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground">
                        {index}
                      </span>

                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] leading-6 text-foreground">
                          {q.text}
                        </p>

                        <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-2">
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                            {q.questionType.replace(/_/g, " ")}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {q.marks} mark{q.marks === 1 ? "" : "s"}
                            {q.negativeMarks > 0 &&
                              ` · −${q.negativeMarks} negative`}
                          </span>
                          {q.difficulty && (
                            <span className="text-[11px] text-muted-foreground">
                              {q.difficulty.toLowerCase()}
                            </span>
                          )}
                        </div>

                        {q.options.length > 0 && (
                          <ul className="mt-2.5 grid min-w-0 gap-1.5 sm:grid-cols-2">
                            {q.options.map((o) => (
                              <li
                                key={o.id}
                                className={cn(
                                  "flex min-w-0 items-center gap-2 rounded-field border px-2.5 py-1.5 text-[12px]",
                                  revealAnswers && o.isCorrect
                                    ? "border-success bg-success-light text-[#047857]"
                                    : "border-border text-[#475569]",
                                )}
                              >
                                {revealAnswers && o.isCorrect && (
                                  <CheckCircle2
                                    className="h-3.5 w-3.5 shrink-0"
                                    aria-label="Correct answer"
                                  />
                                )}
                                <span className="min-w-0">{o.text}</span>
                              </li>
                            ))}
                          </ul>
                        )}

                        {revealAnswers && q.explanation && (
                          <p className="mt-2 rounded-field bg-background px-3 py-2 text-[12px] leading-5 text-muted-foreground">
                            {q.explanation}
                          </p>
                        )}
                      </div>

                      {action?.(q, index)}
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}
    </div>
  );
}
