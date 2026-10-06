import { useEffect, useRef, useState, type FormEvent } from "react";
import type { BookSnapshot, Kind } from "@/lib/ledger/types";
import { evaluateCalculatorExpression } from "@/components/ledger/calculator";
import { errorMessage } from "@/components/ledger/money";

type Draft = {
  id: string;
  entryDate: string;
  kind: Kind;
  category: string;
  description: string;
  ownerName: string;
  paymentMethod: string;
  amount: string;
  note: string;
};

type SaveRow = {
  entryDate: string;
  kind: Kind;
  category: string;
  description: string;
  ownerName: string;
  paymentMethod: string;
  amount: number;
  note: string;
};

const SHORTCUTS = [
  ["⌘/Ctrl + L", "행 추가"],
  ["⌘/Ctrl + D", "현재 행 복제"],
  ["⌘/Ctrl + Shift + C", "금액 계산기"],
  ["Esc", "계산기 닫기"],
  ["Enter", "계산값 적용"],
] as const;

function newId() {
  return Math.random().toString(36).slice(2, 10);
}

function blankDraft(snap: BookSnapshot, today: string, kind: Kind = "expense"): Draft {
  const categories = kind === "income" ? snap.incomeCategories : snap.expenseCategories;
  return {
    id: newId(),
    entryDate: today,
    kind,
    category: categories[0] ?? "",
    description: "",
    ownerName: snap.owners[0] ?? "",
    paymentMethod: snap.payments[0] ?? "",
    amount: "",
    note: "",
  };
}

function isBlank(draft: Draft) {
  return !draft.description.trim() && !draft.amount.trim() && !draft.note.trim();
}

function shortcutKey(event: KeyboardEvent, key: string, options: { shift?: boolean } = {}) {
  if (event.defaultPrevented || event.repeat || event.isComposing) return false;
  if (event.key.toLowerCase() !== key) return false;
  if (!(event.metaKey || event.ctrlKey) || event.altKey) return false;
  if (options.shift) return event.shiftKey;
  return !event.shiftKey;
}

export function EntryEditor({
  snap,
  today,
  saving,
  onSave,
}: {
  snap: BookSnapshot;
  today: string;
  saving: boolean;
  onSave: (rows: SaveRow[]) => Promise<void>;
}) {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [localError, setLocalError] = useState("");
  const [calculator, setCalculator] = useState<{ rowId: string; expression: string; status: string } | null>(null);
  const focusId = useRef<string | null>(null);

  useEffect(() => {
    if (!today || drafts.length > 0) return;
    setDrafts([blankDraft(snap, today)]);
  }, [snap, today, drafts.length]);

  useEffect(() => {
    const id = focusId.current;
    if (!id) return;
    const field = document.querySelector<HTMLInputElement>(`[data-draft-id="${id}"] input[name="description"]`);
    field?.focus();
    focusId.current = null;
  }, [drafts]);

  function update(id: string, patch: Partial<Draft>) {
    setDrafts((current) => current.map((draft) => (draft.id === id ? { ...draft, ...patch } : draft)));
  }

  function addRow(afterId?: string, source?: Draft) {
    const base = source ? { ...source, id: newId() } : blankDraft(snap, today);
    focusId.current = base.id;
    setDrafts((current) => {
      if (!afterId) return [...current, base];
      const index = current.findIndex((draft) => draft.id === afterId);
      if (index < 0) return [...current, base];
      return [...current.slice(0, index + 1), base, ...current.slice(index + 1)];
    });
  }

  function focusedDraftId() {
    const focused = document.activeElement?.closest<HTMLElement>("[data-draft-id]")?.dataset.draftId;
    return focused || drafts.at(-1)?.id || "";
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (calculator && event.key === "Escape") {
        event.preventDefault();
        setCalculator(null);
        return;
      }
      if (calculator) return;
      if (shortcutKey(event, "l")) {
        event.preventDefault();
        addRow();
        return;
      }
      if (shortcutKey(event, "c", { shift: true })) {
        const rowId = focusedDraftId();
        const draft = drafts.find((item) => item.id === rowId);
        if (!draft) return;
        event.preventDefault();
        setCalculator({ rowId, expression: draft.amount || "0", status: "" });
        return;
      }
      if (shortcutKey(event, "d")) {
        const rowId = focusedDraftId();
        const draft = drafts.find((item) => item.id === rowId);
        if (!draft) return;
        event.preventDefault();
        event.stopPropagation();
        addRow(rowId, draft);
      }
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  });

  async function submit(event: FormEvent) {
    event.preventDefault();
    const filled = drafts.filter((draft) => !isBlank(draft));
    if (filled.length === 0) {
      setLocalError("저장할 가계부 항목을 한 건 이상 입력해 주세요.");
      return;
    }
    const rows: SaveRow[] = [];
    for (const [index, draft] of filled.entries()) {
      const amount = Number(draft.amount.replace(/[^\d]/g, ""));
      if (!draft.entryDate || !draft.description.trim() || !amount) {
        setLocalError(`${index + 1}번째 항목의 날짜, 내용, 금액을 입력해 주세요.`);
        return;
      }
      rows.push({
        entryDate: draft.entryDate,
        kind: draft.kind,
        category: draft.category,
        description: draft.description.trim(),
        ownerName: draft.ownerName,
        paymentMethod: draft.paymentMethod,
        amount,
        note: draft.note.trim(),
      });
    }
    setLocalError("");
    try {
      await onSave(rows);
    } catch (caught) {
      setLocalError(errorMessage(caught));
      return;
    }
    const reset = blankDraft(snap, today);
    focusId.current = reset.id;
    setDrafts([reset]);
    setCalculator(null);
  }

  function applyCalculator() {
    if (!calculator) return;
    try {
      const amount = evaluateCalculatorExpression(calculator.expression);
      update(calculator.rowId, { amount: String(amount) });
      const rowId = calculator.rowId;
      setCalculator(null);
      window.setTimeout(() => {
        document.querySelector<HTMLInputElement>(`[data-draft-id="${rowId}"] input[name="amount"]`)?.focus();
      }, 0);
    } catch (caught) {
      setCalculator({ ...calculator, status: errorMessage(caught) });
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="rounded-lg border border-line bg-card p-5">
      <div className="flex flex-wrap gap-2">
        {SHORTCUTS.map(([keys, label]) => (
          <span key={keys} className="inline-flex items-center gap-2 rounded-md border border-line px-2 py-1 text-sm text-muted">
            <kbd className="font-medium text-ink">{keys}</kbd>
            {label}
          </span>
        ))}
      </div>
      <div className="mt-4 space-y-4">
        {drafts.map((draft, index) => {
          const categories = draft.kind === "income" ? snap.incomeCategories : snap.expenseCategories;
          return (
            <fieldset key={draft.id} data-draft-id={draft.id} className="rounded-md border border-line p-3">
              <legend className="px-1 text-sm text-muted">{index + 1}번째</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm text-muted">
                  날짜
                  <input type="date" required value={draft.entryDate} onChange={(event) => update(draft.id, { entryDate: event.target.value })} className={fieldClass} />
                </label>
                <label className="block text-sm text-muted">
                  수입 / 지출
                  <select
                    value={draft.kind}
                    onChange={(event) => {
                      const kind = event.target.value as Kind;
                      const next = kind === "income" ? snap.incomeCategories : snap.expenseCategories;
                      update(draft.id, { kind, category: next[0] ?? "" });
                    }}
                    className={fieldClass}
                  >
                    <option value="expense">지출</option>
                    <option value="income">수입</option>
                  </select>
                </label>
                <label className="block text-sm text-muted">
                  카테고리
                  <select value={draft.category} onChange={(event) => update(draft.id, { category: event.target.value })} className={fieldClass}>
                    {categories.map((name) => (
                      <option key={name}>{name}</option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm text-muted">
                  금액
                  <span className="mt-1 flex gap-2">
                    <input name="amount" inputMode="numeric" value={draft.amount} onChange={(event) => update(draft.id, { amount: event.target.value })} placeholder="0" className={fieldClass} />
                    <button
                      type="button"
                      aria-label="금액 계산기 열기"
                      onClick={() => setCalculator({ rowId: draft.id, expression: draft.amount || "0", status: "" })}
                      className="h-11 shrink-0 rounded-md border border-line px-3 text-sm"
                    >
                      계산
                    </button>
                  </span>
                </label>
                <label className="block text-sm text-muted sm:col-span-2">
                  내용
                  <input name="description" value={draft.description} onChange={(event) => update(draft.id, { description: event.target.value })} className={fieldClass} />
                </label>
                <label className="block text-sm text-muted">
                  명의
                  <select value={draft.ownerName} onChange={(event) => update(draft.id, { ownerName: event.target.value })} className={fieldClass}>
                    {snap.owners.map((name) => (
                      <option key={name}>{name}</option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm text-muted">
                  지출방식
                  <select value={draft.paymentMethod} onChange={(event) => update(draft.id, { paymentMethod: event.target.value })} className={fieldClass}>
                    {snap.payments.map((name) => (
                      <option key={name}>{name}</option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm text-muted sm:col-span-2">
                  비고
                  <input value={draft.note} onChange={(event) => update(draft.id, { note: event.target.value })} className={fieldClass} />
                </label>
              </div>
              <button
                type="button"
                disabled={drafts.length === 1}
                onClick={() => setDrafts((current) => current.filter((item) => item.id !== draft.id))}
                className="mt-3 text-sm text-expense disabled:opacity-40"
              >
                이 행 삭제
              </button>
            </fieldset>
          );
        })}
      </div>
      {localError ? <p className="mt-3 text-sm text-expense">{localError}</p> : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => addRow()} className="h-11 rounded-md border border-line px-4 text-sm">
          행 추가
        </button>
        <button type="submit" disabled={saving} className="h-11 rounded-md bg-accent px-4 text-sm font-medium text-accent-fg disabled:opacity-60">
          {saving ? "저장 중" : `${snap.me.displayName} 이름으로 저장`}
        </button>
      </div>
      {calculator ? (
        <div className="fixed inset-0 z-20 grid place-items-center bg-ink/30 p-4" onClick={() => setCalculator(null)}>
          <div
            role="dialog"
            aria-label="빠른 금액 계산"
            className="w-full max-w-sm rounded-lg border border-line bg-card p-4"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="text-sm text-muted">{drafts.find((draft) => draft.id === calculator.rowId)?.description || "입력항목"}</p>
            <input
              autoFocus
              value={calculator.expression}
              onChange={(event) => setCalculator({ ...calculator, expression: event.target.value, status: "" })}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  applyCalculator();
                }
              }}
              className={`${fieldClass} mt-2 text-right text-lg`}
            />
            <div className="mt-3 grid grid-cols-4 gap-2">
              {["7", "8", "9", "/", "4", "5", "6", "*", "1", "2", "3", "-", "0", "(", ")", "+"].map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setCalculator({ ...calculator, expression: `${calculator.expression}${key}`, status: "" })}
                  className="h-11 rounded-md border border-line text-sm"
                >
                  {key === "*" ? "×" : key === "/" ? "÷" : key}
                </button>
              ))}
            </div>
            {calculator.status ? <p className="mt-2 text-sm text-expense">{calculator.status}</p> : null}
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={() => setCalculator(null)} className="h-11 flex-1 rounded-md border border-line text-sm">
                닫기
              </button>
              <button type="button" onClick={applyCalculator} className="h-11 flex-1 rounded-md bg-accent text-sm font-medium text-accent-fg">
                금액에 적용
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </form>
  );
}

const fieldClass = "mt-1 h-11 w-full rounded-md border border-line bg-paper px-3 text-sm text-ink";
