import { sendMagicLink } from "./actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ sent?: string; error?: string }> }) {
  const { sent, error } = await searchParams;
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-8 px-6">
      <div>
        <h1 className="t-title">Mission Control</h1>
        <p className="mt-2 text-muted">Log in met een link in je mail.</p>
      </div>
      {sent ? (
        <p className="rounded-[16px] bg-surface p-4">Check je mail. De link is 1 uur geldig.</p>
      ) : (
        <form action={sendMagicLink} className="flex flex-col gap-3">
          <label className="t-meta" htmlFor="email">E-mail</label>
          <input id="email" name="email" type="email" required autoComplete="email"
            className="h-12 rounded-[12px] border border-line bg-bg px-4 text-base outline-none focus:border-ink" />
          <button className="h-12 rounded-[12px] bg-ink font-semibold text-bg">Stuur link</button>
          {error && <p className="t-meta">Dat lukte niet. Probeer het opnieuw.</p>}
        </form>
      )}
    </main>
  );
}
