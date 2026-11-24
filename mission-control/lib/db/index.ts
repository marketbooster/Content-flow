import "server-only";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Repo } from "./repo";
import { createSupabaseRepo } from "./supabase";
import { createMemoryRepo } from "./memory";

export const isDemo = () => !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** Supabase-client met de sessie van de ingelogde gebruiker (RLS geldt). */
export async function userClient() {
  const store = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // In Server Components mag je geen cookies zetten; proxy.ts ververst de sessie.
        }
      },
    },
  });
}

/** Repo voor UI-acties: jouw sessie, RLS actief. */
export async function repo(): Promise<Repo> {
  if (isDemo()) return createMemoryRepo();
  return createSupabaseRepo(await userClient());
}

/** Repo voor cron, agents en dispatcher: service role, alleen op de server. */
export function serviceRepo(): Repo {
  if (isDemo()) return createMemoryRepo();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY ontbreekt");
  return createSupabaseRepo(
    createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth: { persistSession: false, autoRefreshToken: false } }),
  );
}

/** Controleer in elke server action dat jij het bent. In demo-modus altijd toegestaan. */
export async function requireOwner(): Promise<void> {
  if (isDemo()) return;
  const supabase = await userClient();
  const { data } = await supabase.auth.getUser();
  const owner = process.env.OWNER_EMAIL?.toLowerCase();
  if (!data.user || !owner || data.user.email?.toLowerCase() !== owner) throw new Error("Niet ingelogd");
}
