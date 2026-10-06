import { createFileRoute } from "@tanstack/react-router";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { HomeScreen } from "@/components/ledger/home-screen";
import { SignInPanel } from "@/components/ledger/sign-in-panel";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const { user, isPending } = useCurrentUserState();
  if (user) return <HomeScreen />;
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-5 py-10">
      <p className="font-display text-4xl tracking-tight">gates</p>
      <h1 className="mt-3 text-xl font-medium">여러 사람이 동시에 쓰는 가계부</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        가계부를 만들고 초대 코드를 공유하면, 같은 수입과 지출을 함께 적고 월간·연간 통계를 봅니다.
      </p>
      <div className="mt-8">
        {isPending ? (
          <div className="h-24 animate-pulse rounded-lg bg-line" />
        ) : (
          <SignInPanel />
        )}
      </div>
    </main>
  );
}
