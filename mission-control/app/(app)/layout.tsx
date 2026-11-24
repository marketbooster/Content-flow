import Link from "next/link";
import { Nav } from "@/components/nav";
import { isDemo } from "@/lib/db";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh md:pl-20">
      <header className="mx-auto flex max-w-2xl items-center justify-end px-4 pt-[max(12px,env(safe-area-inset-top))]">
        {isDemo() && <span className="t-meta mr-auto">Demo-modus · lokaal opgeslagen</span>}
        <Link
          href="/profiel"
          aria-label="Profiel, agents, brein, koppelingen en kosten"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-surface text-[15px] font-semibold"
        >
          T
        </Link>
      </header>
      <main className="mx-auto max-w-2xl px-4 pb-28 md:pb-12">{children}</main>
      <Nav />
    </div>
  );
}
