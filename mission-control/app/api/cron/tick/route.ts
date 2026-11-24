import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { serviceRepo } from "@/lib/db";
import { tick } from "@/lib/cron";

export const maxDuration = 300;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  const given = req.headers.get("x-cron-secret") ?? "";
  if (!secret || secret.length < 16) return false;
  const a = Buffer.from(secret);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const report = await tick(serviceRepo());
  return NextResponse.json({ ok: true, report });
}
