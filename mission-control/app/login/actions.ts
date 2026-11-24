"use server";

import { redirect } from "next/navigation";
import { userClient } from "@/lib/db";

export async function sendMagicLink(form: FormData) {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  // Alleen de eigenaar krijgt een link. Voor anderen tonen we hetzelfde scherm (geen informatielek).
  if (email && email === process.env.OWNER_EMAIL?.toLowerCase()) {
    const supabase = await userClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${process.env.APP_URL}/auth/callback`, shouldCreateUser: true },
    });
    if (error) redirect("/login?error=1");
  }
  redirect("/login?sent=1");
}
