import { GROK_PROVIDERS, signIn } from "@/lib/auth/client";

export function SignInPanel({ redirect = "/" }: { redirect?: string }) {
  return (
    <div className="flex w-full max-w-sm flex-col gap-3">
      <p className="text-sm text-muted">같은 가계부를 함께 쓰려면 계정으로 들어오세요.</p>
      {GROK_PROVIDERS.map((provider) => (
        <button
          key={provider.providerId}
          type="button"
          onClick={() => signIn(provider.providerId, { callbackURL: redirect })}
          className="flex h-11 w-full items-center justify-center rounded-md border border-line bg-card text-sm font-medium text-ink"
        >
          {provider.label}로 계속
        </button>
      ))}
    </div>
  );
}
