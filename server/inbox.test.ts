import { describe, expect, it } from "vitest";
import { Ledger, memoryStore, RateLimiter, type LedgerEntry } from "./ai/ledger";
import { type AIJob, Orchestrator } from "./ai/orchestrator";
import type { AIProvider, ProviderId } from "./ai/providers/types";
import { Inbox, type InboxItem } from "./inbox";
import { createApp } from "./index";

const off = (id: ProviderId): AIProvider => ({
  id, label: id, model: "-", pricing: null, configured: false, configProblem: "x",
  generateJSON: async () => { throw new Error("niet gebruikt"); },
});
const TOKEN = "inbox-token-voor-de-test-1234567890";
const mk = (token?: string) => {
  const inbox = new Inbox(memoryStore<InboxItem[]>([]));
  const orch = new Orchestrator({ anthropic: off("anthropic"), openai: off("openai") }, new Ledger(memoryStore<LedgerEntry[]>([])), memoryStore<AIJob[]>([]), { monthlyBudgetUSD: 1, councilMonthlyLimit: 1, maxTokens: 100 });
  return { inbox, app: createApp(orch, new RateLimiter(100), "app-wachtwoord-123", { inbox, token }) };
};
const basic = { Authorization: `Basic ${Buffer.from("x:app-wachtwoord-123").toString("base64")}` };
const tips = {
  source: "metapic",
  items: [
    { title: "Mango Black Friday -40%", store: "Mango", url: "https://shop.mango.com/nl/sale?utm=x", price: "€29,99", idea: "Outfit onder €50" },
    { title: "HEMA Takkie mok", store: "HEMA", url: "https://www.hema.nl/takkie-mok-1.html" },
  ],
};
const post = (app: ReturnType<typeof mk>["app"], body: unknown, headers: Record<string, string>) =>
  app.request("/api/inbox", { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });

describe("inbox voor geplande taken", () => {
  it("accepteert tips met de juiste sleutel en slaat dubbelen over", async () => {
    const { app } = mk(TOKEN);
    const r1 = await post(app, tips, { "x-inbox-token": TOKEN });
    expect(r1.status).toBe(200);
    expect(await r1.json()).toEqual({ added: 2, skipped: 0 });
    // Zelfde url met andere querystring telt als dubbel.
    const again = { source: "metapic", items: [{ title: "Mango opnieuw", url: "https://shop.mango.com/nl/sale?utm=y" }] };
    expect(await (await post(app, again, { "x-inbox-token": TOKEN })).json()).toEqual({ added: 0, skipped: 1 });
  });
  it("weigert zonder of met verkeerde sleutel, en het app-wachtwoord is niet genoeg", async () => {
    const { app } = mk(TOKEN);
    expect((await post(app, tips, {})).status).toBe(401);
    expect((await post(app, tips, { "x-inbox-token": "fout" })).status).toBe(401);
    expect((await post(app, tips, basic)).status).toBe(401);
  });
  it("is uit zolang er geen INBOX_TOKEN is", async () => {
    const { app } = mk(undefined);
    expect((await post(app, tips, { "x-inbox-token": "iets" })).status).toBe(503);
  });
  it("valideert de inhoud", async () => {
    const { app } = mk(TOKEN);
    expect((await post(app, { source: "onbekend", items: [] }, { "x-inbox-token": TOKEN })).status).toBe(400);
    expect((await post(app, { source: "hema", items: [{ title: "x", url: "geen-url" }] }, { "x-inbox-token": TOKEN })).status).toBe(400);
  });
  it("lezen en afhandelen kan alleen in de app (met wachtwoord); de sleutel geeft alleen statistiek", async () => {
    const { app } = mk(TOKEN);
    await post(app, tips, { "x-inbox-token": TOKEN });
    expect((await app.request("/api/inbox", { headers: { "x-inbox-token": TOKEN } })).status).toBe(401);
    const list = await (await app.request("/api/inbox", { headers: basic })).json() as { items: InboxItem[] };
    expect(list.items).toHaveLength(2);
    const id = list.items[0].id;
    const patched = await app.request(`/api/inbox/${id}`, { method: "PATCH", headers: { ...basic, "content-type": "application/json" }, body: JSON.stringify({ status: "afgewezen" }) });
    expect(((await patched.json()) as InboxItem).status).toBe("afgewezen");
    const stats = await (await app.request("/api/inbox/stats", { headers: { "x-inbox-token": TOKEN } })).json() as { total: number; bySource: Record<string, { nieuw: number }> };
    expect(stats.total).toBe(2);
    expect(stats.bySource.metapic.nieuw).toBe(1);
  });
});

