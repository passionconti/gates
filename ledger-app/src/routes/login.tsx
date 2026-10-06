import { createFileRoute, Link } from "@tanstack/react-router";
import { SignInGate } from "@/lib/auth/gates";
import { SignInPanel } from "@/components/ledger/sign-in-panel";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-5 py-10">
      <p className="font-display text-3xl tracking-tight text-ink">gates</p>
      <h1 className="mt-2 text-lg font-medium">공동 가계부</h1>
      <div className="mt-8">
        <SignInGate
          fallback={<SignInPanel />}
        >
          <p className="text-sm text-muted">이미 로그인되어 있습니다.</p>
          <Link to="/" className="mt-4 inline-flex h-11 items-center text-sm font-medium text-accent">
            가계부로 이동
          </Link>
        </SignInGate>
      </div>
    </main>
  );
}
