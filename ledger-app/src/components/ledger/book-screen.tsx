import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { UserButton } from "@/lib/auth/gates";
import {
  addCategory,
  addEntry,
  addOwner,
  deleteEntry,
  syncHousehold,
} from "@/lib/ledger/server";
import type { BookSnapshot, EntryRow, Kind } from "@/lib/ledger/types";
import { errorMessage, grouped, kindLabel, sums, won } from "@/components/ledger/money";
import { EntryEditor } from "@/components/ledger/entry-editor";

type Tab = "entry" | "list" | "month" | "year" | "people";

function monthKey(date: string) {
  return date.slice(0, 7);
}

export function BookScreen({ bookId }: { bookId: string }) {
  const [year, setYear] = useState<number | null>(null);
  const [month, setMonth] = useState("");
  const [snap, setSnap] = useState<BookSnapshot | null>(null);
  const [tab, setTab] = useState<Tab>("entry");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [knownIds, setKnownIds] = useState<Set<string>>(new Set());
  const [today, setToday] = useState("");
  const [categoryKind, setCategoryKind] = useState<Kind>("expense");
  const [listKind, setListKind] = useState<"" | Kind>("");
  const [listOwner, setListOwner] = useState("");
  const [query, setQuery] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newOwner, setNewOwner] = useState("");

  useEffect(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    setToday(`${y}-${m}-${d}`);
    setYear(y);
    setMonth(`${y}-${m}`);
  }, []);

  useEffect(() => {
    if (year === null) return;
    let stop = false;
    async function pull() {
      try {
        const next = await syncHousehold({ data: { bookId, year } });
        if (stop) return;
        setSnap((previous) => {
          if (previous) {
            const fresh = next.entries.find((entry) => !previous.entries.some((old) => old.id === entry.id));
            if (fresh && fresh.actorUserId !== next.me.userId) {
              setNotice(`${fresh.actorName} 님이 ${kindLabel(fresh.kind)}을 추가했습니다.`);
            }
          }
          return next;
        });
        setKnownIds(new Set(next.entries.map((entry) => entry.id)));
        setError("");
      } catch (caught) {
        if (!stop) setError(errorMessage(caught));
      }
    }
    void pull();
    const timer = window.setInterval(() => void pull(), 3000);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, [bookId, year]);

  const monthEntries = useMemo(
    () => (snap ? snap.entries.filter((entry) => monthKey(entry.entryDate) === month) : []),
    [snap, month],
  );
  const filtered = useMemo(() => {
    return monthEntries.filter((entry) => {
      if (listKind && entry.kind !== listKind) return false;
      if (listOwner && entry.ownerName !== listOwner) return false;
      if (query && !`${entry.description} ${entry.category} ${entry.note}`.includes(query.trim())) return false;
      return true;
    });
  }, [monthEntries, listKind, listOwner, query]);

  async function saveRows(
    rows: Array<{
      entryDate: string;
      kind: Kind;
      category: string;
      description: string;
      ownerName: string;
      paymentMethod: string;
      amount: number;
      note: string;
    }>,
  ) {
    if (!snap) return;
    setSaving(true);
    setError("");
    try {
      for (const row of rows) {
        await addEntry({ data: { bookId, ...row } });
      }
      setNotice("저장했습니다. 다른 구성원 화면에도 곧 보입니다.");
      if (year !== null) setSnap(await syncHousehold({ data: { bookId, year } }));
    } catch (caught) {
      setError(errorMessage(caught));
      throw caught;
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(entry: EntryRow) {
    setError("");
    try {
      await deleteEntry({ data: { bookId, entryId: entry.id } });
      if (year !== null) setSnap(await syncHousehold({ data: { bookId, year } }));
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  async function onAddCategory(event: FormEvent) {
    event.preventDefault();
    if (!newCategory.trim()) return;
    try {
      await addCategory({ data: { bookId, kind: categoryKind, name: newCategory.trim() } });
      setNewCategory("");
      if (year !== null) setSnap(await syncHousehold({ data: { bookId, year } }));
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  async function onAddOwner(event: FormEvent) {
    event.preventDefault();
    if (!newOwner.trim()) return;
    try {
      await addOwner({ data: { bookId, name: newOwner.trim() } });
      setNewOwner("");
      if (year !== null) setSnap(await syncHousehold({ data: { bookId, year } }));
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  const yearBars = useMemo(() => {
    if (!snap || year === null) return [];
    return Array.from({ length: 12 }, (_, index) => {
      const key = `${year}-${String(index + 1).padStart(2, "0")}`;
      const rows = snap.entries.filter((entry) => monthKey(entry.entryDate) === key);
      const total = sums(rows);
      return { name: `${index + 1}월`, 수입: total.income, 지출: total.expense };
    });
  }, [snap, year]);

  const monthStats = sums(monthEntries);
  const yearStats = sums(snap?.entries ?? []);
  const expenseMonth = monthEntries.filter((entry) => entry.kind === "expense");

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-6 sm:px-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link to="/" className="text-sm text-muted">
            가계부 목록
          </Link>
          <h1 className="mt-1 font-display text-4xl tracking-tight">{snap?.name ?? "가계부"}</h1>
          {snap ? (
            <button
              type="button"
              className="mt-2 text-sm tracking-widest text-muted"
              onClick={() => {
                void navigator.clipboard.writeText(snap.inviteCode);
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1500);
              }}
            >
              초대 {snap.inviteCode}
              {copied ? " · 복사됨" : " · 복사"}
            </button>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            {(snap?.presence ?? []).map((person) => (
              <span
                key={person.userId}
                title={person.displayName}
                className="grid h-9 w-9 place-items-center rounded-full bg-accent-soft text-sm font-medium text-accent"
              >
                {person.displayName.slice(0, 1)}
              </span>
            ))}
          </div>
          <UserButton />
        </div>
      </header>
      <p className="mt-3 text-sm text-muted">
        {snap ? `지금 ${snap.presence.length}명이 이 장부를 보고 있습니다. 3초마다 맞춰집니다.` : "장부를 불러오는 중"}
      </p>
      {notice ? <p className="mt-2 text-sm text-accent">{notice}</p> : null}
      {error ? <p className="mt-2 text-sm text-expense">{error}</p> : null}

      <nav className="mt-5 flex gap-2 overflow-x-auto border-b border-line">
        {(
          [
            ["entry", "입력"],
            ["list", "내역"],
            ["month", "월간"],
            ["year", "연간"],
            ["people", "구성"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`h-11 shrink-0 border-b-2 px-3 text-sm ${tab === id ? "border-ink font-medium" : "border-transparent text-muted"}`}
          >
            {label}
          </button>
        ))}
      </nav>

      {!snap || year === null ? (
        <div className="mt-6 h-40 animate-pulse rounded-lg bg-line/50" />
      ) : (
        <div className="mt-6">
          {tab === "entry" ? (
            <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <EntryEditor snap={snap} today={today} saving={saving} onSave={saveRows} />
              <Kpis title="이번 달" stats={monthStats} />
            </div>
          ) : null}

          {tab === "list" ? (
            <section>
              <div className="flex flex-wrap gap-2">
                <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} className={fieldClass} />
                <select value={listKind} onChange={(event) => setListKind(event.target.value as "" | Kind)} className={fieldClass}>
                  <option value="">전체</option>
                  <option value="income">수입</option>
                  <option value="expense">지출</option>
                </select>
                <select value={listOwner} onChange={(event) => setListOwner(event.target.value)} className={fieldClass}>
                  <option value="">전체 명의</option>
                  {snap.owners.map((name) => (
                    <option key={name}>{name}</option>
                  ))}
                </select>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="내용 검색"
                  className={fieldClass}
                />
              </div>
              <div className="mt-4 overflow-x-auto rounded-lg border border-line bg-card">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="text-muted">
                    <tr>
                      {["날짜", "구분", "카테고리", "내용", "명의", "작성", "금액", ""].map((label) => (
                        <th key={label} className="px-3 py-3 font-medium">
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-3 py-8 text-muted">
                          이 조건의 내역이 없습니다.
                        </td>
                      </tr>
                    ) : (
                      filtered.map((entry) => (
                        <tr key={entry.id} className={knownIds.has(entry.id) ? "border-t border-line" : "border-t border-line bg-accent-soft"}>
                          <td className="px-3 py-3 tabular-nums">{entry.entryDate.slice(2)}</td>
                          <td className="px-3 py-3">
                            <span className={entry.kind === "income" ? "text-accent" : "text-expense"}>
                              {kindLabel(entry.kind)}
                            </span>
                          </td>
                          <td className="px-3 py-3">{entry.category}</td>
                          <td className="px-3 py-3">
                            {entry.description}
                            {entry.note ? <span className="mt-1 block text-muted">{entry.note}</span> : null}
                          </td>
                          <td className="px-3 py-3">{entry.ownerName}</td>
                          <td className="px-3 py-3">{entry.actorName}</td>
                          <td className="px-3 py-3 text-right tabular-nums">{won(entry.amount)}</td>
                          <td className="px-3 py-3">
                            <button type="button" onClick={() => void onDelete(entry)} className="text-expense">
                              삭제
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {tab === "month" ? (
            <section className="space-y-4">
              <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} className={fieldClass} />
              <Kpis title={month || "월"} stats={monthStats} />
              <Bars title="지출 카테고리" rows={grouped(expenseMonth, "category")} tone="expense" />
              <Bars title="명의" rows={grouped(monthEntries, "ownerName")} tone="ink" />
              <Bars title="작성자" rows={grouped(monthEntries, "actorName")} tone="ink" />
            </section>
          ) : null}

          {tab === "year" ? (
            <section className="space-y-4">
              <input
                type="number"
                min={2000}
                max={2100}
                value={year}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  if (next >= 2000 && next <= 2100) setYear(next);
                }}
                className={`${fieldClass} w-28`}
              />
              <Kpis title={`${year}년`} stats={yearStats} />
              <div className="h-64 rounded-lg border border-line bg-card p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={yearBars}>
                    <XAxis dataKey="name" tick={{ fill: "#78716c", fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis hide />
                    <Tooltip formatter={(value) => won(Number(value ?? 0))} />
                    <Bar dataKey="수입" fill="#1d5c40" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="지출" fill="#9a3412" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <Bars
                title="연간 지출 카테고리"
                rows={grouped(
                  snap.entries.filter((entry) => entry.kind === "expense"),
                  "category",
                )}
                tone="expense"
              />
            </section>
          ) : null}

          {tab === "people" ? (
            <section className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-line bg-card p-5">
                <h2 className="font-medium">구성원</h2>
                <ul className="mt-3 space-y-2 text-sm">
                  {snap.members.map((member) => (
                    <li key={member.userId} className="flex justify-between">
                      <span>{member.displayName}</span>
                      <span className="text-muted">{member.role === "owner" ? "만든 사람" : "구성원"}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-sm leading-relaxed text-muted">
                  다른 사람은 초대 코드 {snap.inviteCode}로 들어온 뒤, 같은 화면에서 바로 입력할 수 있습니다.
                </p>
              </div>
              <div className="space-y-4">
                <form onSubmit={onAddCategory} className="rounded-lg border border-line bg-card p-5">
                  <h2 className="font-medium">{categoryKind === "income" ? "수입" : "지출"} 카테고리</h2>
                  <div className="mt-3 flex gap-2">
                    <select value={categoryKind} onChange={(event) => setCategoryKind(event.target.value as Kind)} className={fieldClass}>
                      <option value="expense">지출</option>
                      <option value="income">수입</option>
                    </select>
                    <input value={newCategory} onChange={(event) => setNewCategory(event.target.value)} className={fieldClass} />
                    <button type="submit" className="h-11 shrink-0 rounded-md bg-ink px-3 text-sm text-paper">
                      추가
                    </button>
                  </div>
                </form>
                <form onSubmit={onAddOwner} className="rounded-lg border border-line bg-card p-5">
                  <h2 className="font-medium">명의</h2>
                  <div className="mt-3 flex gap-2">
                    <input value={newOwner} onChange={(event) => setNewOwner(event.target.value)} className={fieldClass} />
                    <button type="submit" className="h-11 shrink-0 rounded-md bg-ink px-3 text-sm text-paper">
                      추가
                    </button>
                  </div>
                  <p className="mt-3 text-sm text-muted">{snap.owners.join(" · ")}</p>
                </form>
              </div>
            </section>
          ) : null}
        </div>
      )}
    </main>
  );
}

const fieldClass = "h-11 w-full rounded-md border border-line bg-paper px-3 text-sm text-ink";

function Kpis({ title, stats }: { title: string; stats: { income: number; expense: number; balance: number } }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Stat label={`${title} 수입`} value={won(stats.income)} tone="text-accent" />
      <Stat label={`${title} 지출`} value={won(stats.expense)} tone="text-expense" />
      <Stat label="잔액" value={won(stats.balance)} tone="text-ink" />
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-lg border border-line bg-card p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className={`mt-2 text-xl font-medium tabular-nums ${tone}`}>{value}</p>
    </div>
  );
}

function Bars({ title, rows, tone }: { title: string; rows: Array<[string, number]>; tone: "expense" | "ink" }) {
  const max = Math.max(1, ...rows.map((row) => row[1]));
  return (
    <div className="rounded-lg border border-line bg-card p-5">
      <h2 className="font-medium">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted">내역이 없습니다.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {rows.map(([name, value]) => (
            <li key={name} className="grid grid-cols-[6rem_1fr_auto] items-center gap-3 text-sm">
              <span className="truncate">{name}</span>
              <span className="h-2 rounded-full bg-paper">
                <span
                  className={`block h-2 rounded-full ${tone === "expense" ? "bg-expense" : "bg-accent"}`}
                  style={{ width: `${Math.round((value / max) * 100)}%` }}
                />
              </span>
              <span className="tabular-nums">{won(value)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
