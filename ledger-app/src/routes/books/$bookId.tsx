import { createFileRoute } from "@tanstack/react-router";
import { SignInGate } from "@/lib/auth/gates";
import { BookScreen } from "@/components/ledger/book-screen";
import { SignInPanel } from "@/components/ledger/sign-in-panel";

export const Route = createFileRoute("/books/$bookId")({
  component: BookPage,
});

function BookPage() {
  const { bookId } = Route.useParams();
  return (
    <SignInGate fallback={<main className="mx-auto max-w-lg px-5 py-16"><SignInPanel redirect={`/books/${bookId}`} /></main>}>
      <BookScreen bookId={bookId} />
    </SignInGate>
  );
}
