import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// Ondertekende, publieke slide-URL's. Instagram moet de afbeelding zelf kunnen ophalen,
// dus de route is zonder login bereikbaar maar alleen met een geldige handtekening.

function secret(): string {
  const s = process.env.SLIDE_SIGNING_SECRET;
  if (s) return s;
  const demo = !process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!demo) throw new Error("SLIDE_SIGNING_SECRET ontbreekt");
  return "demo-only-secret";
}

export function signSlide(itemId: string, index: number): string {
  return createHmac("sha256", secret()).update(`${itemId}:${index}`).digest("base64url").slice(0, 32);
}

export function verifySlide(itemId: string, index: number, sig: string): boolean {
  const expected = Buffer.from(signSlide(itemId, index));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export function slidePath(itemId: string, index: number, format: "png" | "jpeg" = "png"): string {
  return `/api/slides/${itemId}/${index}?sig=${signSlide(itemId, index)}${format === "jpeg" ? "&format=jpeg" : ""}`;
}

export function slideUrl(itemId: string, index: number, format: "png" | "jpeg" = "png"): string {
  const base = (process.env.APP_URL ?? "").replace(/\/$/, "");
  return `${base}${slidePath(itemId, index, format)}`;
}
