import "server-only";
import type { Channel, InboxItem } from "../types";
import { slideUrl } from "../slides";

export interface SendResult {
  externalId?: string;
  externalUrl?: string;
  detail: string;
}

/** 'api' = 1 klik, de dispatcher verstuurt. 'manual' = 1-tap: tekst op klembord, app opent, jij plakt. */
export interface Adapter {
  id: string;
  kind: "api" | "manual" | "none";
  label: string;
  configured: () => boolean;
  /** Waarom niet geconfigureerd / wat ontbreekt. */
  missing: () => string[];
  send?: (item: InboxItem) => Promise<SendResult>;
  /** Voor 1-tap: wat gaat er op het klembord en welke URL opent. */
  manual?: (item: InboxItem) => { clipboard: string; openUrl: string | null };
}

const env = (k: string) => process.env[k] ?? "";
const need = (...keys: string[]) => keys.filter((k) => !env(k));

export class AdapterError extends Error {}

async function postJSON(url: string, body: unknown, headers: Record<string, string>) {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
  const text = await res.text();
  if (!res.ok) throw new AdapterError(`${res.status}: ${text.slice(0, 300)}`);
  return { res, json: text ? (JSON.parse(text) as Record<string, unknown>) : {} };
}

function fullText(item: InboxItem): string {
  const tags = item.payload.hashtags?.length ? `\n\n${item.payload.hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" ")}` : "";
  return item.body + (item.body.includes("#") ? "" : tags);
}

// ── LinkedIn via Buffer ───────────────────────────────────────────────
// Buffer's publieke GraphQL-API. Controleer de velden bij het koppelen in developers.buffer.com;
// de 'Test koppeling'-knop in Profiel → Koppelingen laat direct zien of het klopt.
const bufferLinkedIn: Adapter = {
  id: "buffer",
  kind: "api",
  label: "LinkedIn via Buffer",
  configured: () => need("BUFFER_ACCESS_TOKEN", "BUFFER_LINKEDIN_CHANNEL_ID").length === 0,
  missing: () => need("BUFFER_ACCESS_TOKEN", "BUFFER_LINKEDIN_CHANNEL_ID"),
  async send(item) {
    const query = `mutation CreatePost($input: CreatePostInput!) {
      createPost(input: $input) {
        ... on PostActionSuccess { post { id } }
        ... on MutationError { message }
      }
    }`;
    const { json } = await postJSON(
      "https://api.buffer.com",
      { query, variables: { input: { channelId: env("BUFFER_LINKEDIN_CHANNEL_ID"), text: fullText(item), schedulingType: "automatic", mode: "shareNow" } } },
      { authorization: `Bearer ${env("BUFFER_ACCESS_TOKEN")}` },
    );
    const data = json as { errors?: { message: string }[]; data?: { createPost?: { post?: { id: string }; message?: string } } };
    if (data.errors?.length) throw new AdapterError(data.errors.map((e) => e.message).join("; "));
    const cp = data.data?.createPost;
    if (!cp?.post) throw new AdapterError(cp?.message ?? "Onbekend antwoord van Buffer");
    return { externalId: cp.post.id, detail: "Via Buffer naar LinkedIn" };
  },
};

// ── LinkedIn via eigen app (Share on LinkedIn / Posts API) ───────────
const linkedInShare: Adapter = {
  id: "linkedin_share",
  kind: "api",
  label: "LinkedIn Share-API",
  configured: () => need("LINKEDIN_ACCESS_TOKEN", "LINKEDIN_PERSON_URN").length === 0,
  missing: () => need("LINKEDIN_ACCESS_TOKEN", "LINKEDIN_PERSON_URN"),
  async send(item) {
    const { res } = await postJSON(
      "https://api.linkedin.com/rest/posts",
      {
        author: env("LINKEDIN_PERSON_URN"),
        commentary: fullText(item),
        visibility: "PUBLIC",
        distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
        lifecycleState: "PUBLISHED",
        isReshareDisabledByAuthor: false,
      },
      {
        authorization: `Bearer ${env("LINKEDIN_ACCESS_TOKEN")}`,
        "LinkedIn-Version": env("LINKEDIN_API_VERSION") || "202511",
        "X-Restli-Protocol-Version": "2.0.0",
      },
    );
    const urn = res.headers.get("x-restli-id") ?? undefined;
    return { externalId: urn, externalUrl: urn ? `https://www.linkedin.com/feed/update/${urn}/` : undefined, detail: "Geplaatst via LinkedIn API" };
  },
};

// ── Instagram Graph API ──────────────────────────────────────────────
const graph = (p: string) => `https://graph.facebook.com/${env("META_GRAPH_VERSION") || "v23.0"}/${p}`;

async function igCreate(params: Record<string, string>): Promise<string> {
  const { json } = await postJSON(graph(`${env("INSTAGRAM_USER_ID")}/media`), { ...params, access_token: env("INSTAGRAM_ACCESS_TOKEN") }, {});
  if (typeof json.id !== "string") throw new AdapterError("Instagram gaf geen container-id terug");
  return json.id;
}

const instagram: Adapter = {
  id: "instagram",
  kind: "api",
  label: "Instagram Graph API",
  configured: () => need("INSTAGRAM_USER_ID", "INSTAGRAM_ACCESS_TOKEN", "APP_URL", "SLIDE_SIGNING_SECRET").length === 0,
  missing: () => need("INSTAGRAM_USER_ID", "INSTAGRAM_ACCESS_TOKEN", "APP_URL", "SLIDE_SIGNING_SECRET"),
  async send(item) {
    const caption = fullText(item);
    let creationId: string;
    if (item.type === "carousel" && item.payload.slides?.length) {
      const slides = item.payload.slides.slice(0, 10);
      const children: string[] = [];
      for (let i = 0; i < slides.length; i++) {
        children.push(await igCreate({ image_url: slideUrl(item.id, i, "jpeg"), is_carousel_item: "true" }));
      }
      creationId = await igCreate({ media_type: "CAROUSEL", children: children.join(","), caption });
    } else {
      // Enkele afbeelding: de titelkaart in huisstijl.
      creationId = await igCreate({ image_url: slideUrl(item.id, 0, "jpeg"), caption });
    }
    const { json } = await postJSON(
      graph(`${env("INSTAGRAM_USER_ID")}/media_publish`),
      { creation_id: creationId, access_token: env("INSTAGRAM_ACCESS_TOKEN") },
      {},
    );
    return { externalId: String(json.id ?? ""), detail: "Geplaatst via Instagram Graph API" };
  },
};

// ── 1-tap (handmatig) ─────────────────────────────────────────────────
const manual = (id: string, label: string, url: (i: InboxItem) => string | null): Adapter => ({
  id,
  kind: "manual",
  label,
  configured: () => true,
  missing: () => [],
  manual: (item) => ({ clipboard: fullText(item), openUrl: url(item) }),
});

const linkedInManual = manual("linkedin_manual", "LinkedIn (1-tap)", (i) =>
  i.recipient_key?.includes("linkedin.com") ? `https://${i.recipient_key.replace(/^https?:\/\//, "")}` : "https://www.linkedin.com/feed/",
);
const instagramReelManual = manual("instagram_reel_manual", "Instagram Reel (1-tap na filmen)", () => "https://www.instagram.com/");
const phoneManual = manual("phone", "Bellen (1-tap)", (i) => (i.recipient_key ? `tel:${i.recipient_key.replace(/\s/g, "")}` : null));

const notConnected = (id: string, label: string): Adapter => ({
  id,
  kind: "none",
  label,
  configured: () => false,
  missing: () => ["nog niet gekoppeld"],
});

export const ADAPTERS = {
  bufferLinkedIn,
  linkedInShare,
  instagram,
  linkedInManual,
  instagramReelManual,
  phoneManual,
  gmail: notConnected("gmail", "Gmail (info@) — sprint 2"),
  brevo: notConnected("brevo", "Brevo nieuwsbrief — sprint 2"),
  blog: notConnected("blog", "Blog publiceren — sprint 4"),
  print: notConnected("print", "Printwachtrij brieven — sprint 3"),
};

/** Welke adapter hoort bij dit item? */
export function routeFor(item: InboxItem): Adapter {
  const ch: Channel = item.channel;
  if (ch === "linkedin") {
    if (["comment", "dm", "connect"].includes(item.type)) return linkedInManual; // niet toegestaan via API
    if (item.type === "carousel") return linkedInManual; // PDF-document-post volgt; nu: kopieer tekst + download slides
    return env("LINKEDIN_ROUTE") === "share_api" ? linkedInShare : bufferLinkedIn;
  }
  if (ch === "instagram") {
    if (item.type === "reel") return instagramReelManual; // eerst video uploaden; automatisch publiceren volgt
    return instagram;
  }
  if (ch === "phone") return phoneManual;
  if (ch === "email") return ADAPTERS.gmail;
  if (ch === "newsletter") return ADAPTERS.brevo;
  if (ch === "blog") return ADAPTERS.blog;
  return ADAPTERS.print;
}
