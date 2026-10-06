import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { UserButton } from "@/lib/auth/gates";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { createHousehold, joinHousehold, listMyHouseholds } from "@/lib/ledger/server";
import type { BookSummary } from "@/lib/ledger/types";
import { errorMessage } from "@/components/ledger/money";

export function HomeScreen() {
  const user = useCurrentUser();
  const navigate = useNavigate();
  const [books, setBooks] = useState<BookSummary[] | null>(null);
  const [name, setName] = useState("우리집 가계부");
  const [code, setCode] = useState("");
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function refresh() {
    const next = await listMyHouseholds();
    setBooks(next);
  }

  useEffect(() => {
    let stop = false;
    listMyHouseholds()
      .then((next) => {
        if (!stop) setBooks(next);
      })
      .catch((caught) => {
        if (!stop) setError(errorMessage(caught));
      });
    return () => {
      stop = true;
    };
  }, []);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const book = await createHousehold({ data: { name, nickname: nickname || undefined } });
      await navigate({ to: "/books/$bookId", params: { bookId: book.id } });
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setPending(false);
    }
  }

  async function onJoin(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const book = await joinHousehold({
        data: { code, nickname: nickname || undefined },
      });
      await navigate({ to: "/books/$bookId", params: { bookId: book.id } });
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-5 py-8">
      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="font-display text-3xl tracking-tight">gates</p>
          <h1 className="mt-1 text-base text-muted">함께 쓰는 가계부</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-muted sm:inline">{user?.displayName}</span>
          <UserButton />
        </div>
      </header>

      <section className="mt-8 grid gap-4 md:grid-cols-2">
        <form onSubmit={onCreate} className="rounded-lg border border-line bg-card p-5">
          <h2 className="text-base font-medium">새 가계부</h2>
          <label className="mt-4 block text-sm text-muted">
            이름
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-1 h-11 w-full rounded-md border border-line bg-paper px-3 text-ink"
              required
            />
          </label>
          <label className="mt-3 block text-sm text-muted">
            내 표시 이름
            <input
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              placeholder={user?.displayName ?? "이름"}
              className="mt-1 h-11 w-full rounded-md border border-line bg-paper px-3 text-ink"
            />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="mt-4 h-11 rounded-md bg-accent px-4 text-sm font-medium text-accent-fg disabled:opacity-60"
          >
            만들기
          </button>
        </form>

        <form onSubmit={onJoin} className="rounded-lg border border-line bg-card p-5">
          <h2 className="text-base font-medium">초대 코드로 참여</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            이미 열린 가계부의 코드를 넣으면 같은 장부를 동시에 기록합니다.
          </p>
          <label className="mt-4 block text-sm text-muted">
            코드
            <input
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              className="mt-1 h-11 w-full rounded-md border border-line bg-paper px-3 tracking-widest text-ink uppercase"
              required
            />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="mt-4 h-11 rounded-md border border-line bg-card px-4 text-sm font-medium"
          >
            참여
          </button>
        </form>
      </section>

      {error ? <p className="mt-4 text-sm text-expense">{error}</p> : null}

      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-medium">내 가계부</h2>
          <button type="button" onClick={() => refresh().catch((caught) => setError(errorMessage(caught)))} className="text-sm text-muted">
            새로고침
          </button>
        </div>
        {books === null ? (
          <div className="mt-3 h-16 animate-pulse rounded-lg bg-line/60" />
        ) : books.length === 0 ? (
          <p className="mt-3 text-sm text-muted">아직 참여한 가계부가 없습니다.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line rounded-lg border border-line bg-card">
            {books.map((book) => (
              <li key={book.id}>
                <button
                  type="button"
                  onClick={() => navigate({ to: "/books/$bookId", params: { bookId: book.id } })}
                  className="flex w-full items-center justify-between px-4 py-3 text-left"
                >
                  <span>
                    <span className="block font-medium">{book.name}</span>
                    <span className="text-sm text-muted">{book.displayName}</span>
                  </span>
                  <span className="text-sm tracking-widest text-muted">{book.inviteCode}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
