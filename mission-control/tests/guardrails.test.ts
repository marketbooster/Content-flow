import { describe, expect, it } from "vitest";
import { budgetState, decideDispatch, isInSendWindow, isSuppressed, nextSendWindowStart, type DispatchContext } from "@/lib/guardrails";
import { fromAms } from "@/lib/time";
import { DEFAULT_SETTINGS, type InboxItem } from "@/lib/types";

const item = (over: Partial<InboxItem> = {}): InboxItem => ({
  id: "i1", created_at: "", agent: "creator", type: "post", channel: "linkedin", recipient: "Je feed",
  recipient_key: null, title: "t", reason: "r", value_hint: null, body: "b", payload: {}, status: "approved",
  priority: 0, visible_from: null, scheduled_at: null, send_after: null, snoozed_until: null, reject_reason: null,
  sent_at: null, result: null, calendar_id: null, lead_id: null, ...over,
});
const ctx = (over: Partial<DispatchContext> = {}): DispatchContext => ({
  now: fromAms(2026, 11, 24, 10, 0), // dinsdag
  settings: DEFAULT_SETTINGS, sentTodayByChannel: {}, suppressed: [], lastContactAt: null, isCustomer: false, ...over,
});

describe("verzendvenster", () => {
  it("werkdag 08:00–17:30 Amsterdam", () => {
    expect(isInSendWindow(fromAms(2026, 11, 24, 7, 59))).toBe(false);
    expect(isInSendWindow(fromAms(2026, 11, 24, 8, 0))).toBe(true);
    expect(isInSendWindow(fromAms(2026, 11, 24, 17, 29))).toBe(true);
    expect(isInSendWindow(fromAms(2026, 11, 24, 17, 30))).toBe(false);
    expect(isInSendWindow(fromAms(2026, 11, 28, 10, 0))).toBe(false); // zaterdag
  });
  it("na vrijdagavond wacht tot maandag 08:00", () => {
    expect(nextSendWindowStart(fromAms(2026, 11, 27, 18, 0)).toISOString()).toBe(fromAms(2026, 11, 30, 8, 0).toISOString());
  });
  it("vroeg in de ochtend: vandaag 08:00", () => {
    expect(nextSendWindowStart(fromAms(2026, 11, 24, 6, 0)).toISOString()).toBe(fromAms(2026, 11, 24, 8, 0).toISOString());
  });
  it("klopt rond zomertijd (29 maart 2026)", () => {
    const d = fromAms(2026, 3, 30, 8, 0);
    expect(d.toISOString()).toBe("2026-03-30T06:00:00.000Z");
  });
});

describe("decideDispatch", () => {
  it("verstuurt binnen venster", () => expect(decideDispatch(item(), ctx()).action).toBe("send"));
  it("niet goedgekeurd → blokkeren", () => expect(decideDispatch(item({ status: "pending" }), ctx()).action).toBe("block"));
  it("pauze → uitstellen", () => expect(decideDispatch(item(), ctx({ settings: { ...DEFAULT_SETTINGS, paused: true } })).action).toBe("defer"));
  it("buiten venster → uitstellen tot volgende ochtend", () => {
    const d = decideDispatch(item(), ctx({ now: fromAms(2026, 11, 24, 20, 0) }));
    expect(d).toMatchObject({ action: "defer" });
    if (d.action === "defer") expect(d.until.toISOString()).toBe(fromAms(2026, 11, 25, 8, 0).toISOString());
  });
  it("daglimiet", () => {
    const d = decideDispatch(item(), ctx({ sentTodayByChannel: { linkedin: 15 } }));
    expect(d.action).toBe("defer");
  });
  it("afmeldlijst blokkeert, ook op domein", () => {
    expect(decideDispatch(item({ type: "email", channel: "email", recipient_key: "jan@bakker.nl" }), ctx({ suppressed: ["bakker.nl"] })).action).toBe("block");
  });
  it("geen tweede benadering binnen 14 dagen", () => {
    const now = fromAms(2026, 11, 24, 10, 0);
    const d = decideDispatch(item({ type: "dm", recipient_key: "linkedin.com/in/jan" }), ctx({ now, lastContactAt: new Date(now.getTime() - 5 * 86_400_000) }));
    expect(d.action).toBe("block");
    const ok = decideDispatch(item({ type: "dm", recipient_key: "linkedin.com/in/jan" }), ctx({ now, lastContactAt: new Date(now.getTime() - 15 * 86_400_000) }));
    expect(ok.action).toBe("send");
  });
  it("eigen post mag wél vaker", () => {
    const now = fromAms(2026, 11, 24, 10, 0);
    expect(decideDispatch(item(), ctx({ now, lastContactAt: now })).action).toBe("send");
  });
  it("nooit naar klanten", () => expect(decideDispatch(item({ type: "email", channel: "email", recipient_key: "a@b.nl" }), ctx({ isCustomer: true })).action).toBe("block"));
  it("koude mail staat standaard uit", () => {
    expect(decideDispatch(item({ type: "email", channel: "email", recipient_key: "a@b.nl", payload: { tags: ["koud"] } }), ctx()).action).toBe("block");
  });
  it("ongedaan-maken-venster", () => {
    const now = fromAms(2026, 11, 24, 10, 0);
    expect(decideDispatch(item({ send_after: new Date(now.getTime() + 3000).toISOString() }), ctx({ now })).action).toBe("defer");
  });
  it("gepland kalendermoment", () => {
    const now = fromAms(2026, 11, 24, 10, 0);
    const d = decideDispatch(item({ scheduled_at: fromAms(2026, 11, 24, 12, 0).toISOString() }), ctx({ now }));
    expect(d.action).toBe("defer");
  });
});

describe("budget en afmeldlijst", () => {
  it("melding bij 80%, stop bij 100%", () => {
    expect(budgetState(79, 100)).toBe("ok");
    expect(budgetState(80, 100)).toBe("warn");
    expect(budgetState(100, 100)).toBe("stop");
  });
  it("normaliseert URL's", () => expect(isSuppressed("https://www.LinkedIn.com/in/jan/", ["linkedin.com/in/jan"])).toBe(true));
});
