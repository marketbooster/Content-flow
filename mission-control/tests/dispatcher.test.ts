import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createMemoryRepo } from "@/lib/db/memory";
import { confirmManual, dispatchDue, dispatchItem } from "@/lib/dispatch/dispatcher";
import { fromAms } from "@/lib/time";
import type { Repo } from "@/lib/db/repo";

const TUE_10 = fromAms(2026, 11, 24, 10, 0);
let repo: Repo;
let cwd: string;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  cwd = process.cwd();
  process.chdir(fs.mkdtempSync(path.join(os.tmpdir(), "mc-")));
  repo = createMemoryRepo();
  process.env.BUFFER_ACCESS_TOKEN = "t";
  process.env.BUFFER_LINKEDIN_CHANNEL_ID = "c";
  process.env.LINKEDIN_ROUTE = "buffer";
  fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: { createPost: { post: { id: "buf_1" } } } })));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  process.chdir(cwd);
  vi.unstubAllGlobals();
});

async function linkedInPost() {
  const items = await repo.listInbox({ statuses: ["pending"] });
  return items.find((i) => i.channel === "linkedin")!;
}

describe("dispatcher", () => {
  it("verstuurt niets dat niet goedgekeurd is", async () => {
    const item = await linkedInPost();
    const out = await dispatchItem(repo, item.id, TUE_10);
    expect(out.outcome).toBe("blocked");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("cron verstuurt niets in de wachtrij zonder goedkeuring", async () => {
    await dispatchDue(repo, TUE_10);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("goedgekeurd → wacht ongedaan-maken-venster → verstuurt en logt", async () => {
    const item = await linkedInPost();
    await repo.updateInboxItem(item.id, { status: "approved", send_after: new Date(TUE_10.getTime() + 5000).toISOString() });
    expect((await dispatchItem(repo, item.id, TUE_10)).outcome).toBe("deferred");
    expect(fetchMock).not.toHaveBeenCalled();

    const later = new Date(TUE_10.getTime() + 6000);
    expect((await dispatchItem(repo, item.id, later)).outcome).toBe("sent");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.variables.input.text).toContain("Vrijdag, 16:40");
    expect((await repo.getInboxItem(item.id))!.status).toBe("sent");
    const log = await repo.listDispatchLog(5);
    expect(log[0]).toMatchObject({ outcome: "sent", external_id: "buf_1", adapter: "buffer" });

    // Nooit twee keer
    await dispatchItem(repo, item.id, later);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("buiten het venster: ingepland, niet verstuurd", async () => {
    const item = await linkedInPost();
    await repo.updateInboxItem(item.id, { status: "approved" });
    const out = await dispatchItem(repo, item.id, fromAms(2026, 11, 24, 21, 0));
    expect(out.outcome).toBe("deferred");
    expect((await repo.getInboxItem(item.id))!.status).toBe("scheduled");
    expect(fetchMock).not.toHaveBeenCalled();
    await dispatchDue(repo, fromAms(2026, 11, 25, 8, 5));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("noodknop: niets gaat eruit", async () => {
    const item = await linkedInPost();
    await repo.updateInboxItem(item.id, { status: "approved" });
    await repo.saveSettings({ paused: true });
    expect((await dispatchItem(repo, item.id, TUE_10)).outcome).toBe("deferred");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("API-fout wordt gelogd als mislukt", async () => {
    fetchMock.mockResolvedValueOnce(new Response("nope", { status: 401 }));
    const item = await linkedInPost();
    await repo.updateInboxItem(item.id, { status: "approved" });
    const out = await dispatchItem(repo, item.id, TUE_10);
    expect(out.outcome).toBe("failed");
    expect((await repo.listDispatchLog(1))[0].outcome).toBe("failed");
  });

  it("1-tap: 14-dagenregel blokkeert een tweede DM", async () => {
    const base = { ...(await linkedInPost()), id: undefined, type: "dm" as const, recipient_key: "linkedin.com/in/jan", status: "pending" as const };
    const [a, b] = await repo.createInboxItems([{ ...base }, { ...base }]);
    expect((await confirmManual(repo, a.id, TUE_10)).outcome).toBe("sent");
    expect((await confirmManual(repo, b.id, new Date(TUE_10.getTime() + 86_400_000))).outcome).toBe("blocked");
  });
});
