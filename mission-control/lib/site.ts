import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { InboxItem } from "./types";
import { readingMinutes } from "./seo";

// Koppeling met marketbooster.nl (Lovable-project "Marketbooster", eigen Supabase).
// - Lezen: gepubliceerde blogs zijn publiek leesbaar (RLS), dus de anon key volstaat.
// - Schrijven: via de bestaande Edge Function `create-blog-draft` (Bearer MAKE_WEBHOOK_SECRET).
//   Die maakt een concept, regelt een unieke slug en genereert automatisch een cover.
// - Publiceren: met SITE_SUPABASE_SERVICE_ROLE_KEY zet de dispatcher het concept direct live.
//   Zonder die key blijft het een concept en publiceer je met één klik in je site-admin.

const env = (k: string) => process.env[k] ?? "";

export interface SitePost {
  slug: string;
  title: string;
  excerpt: string | null;
  tags: string[];
  published_at: string | null;
}

/** Vaste pagina's voor interne links (uit de sitemap van marketbooster.nl). */
export const SITE_PAGES: { url: string; about: string }[] = [
  { url: "/gratis-ai-scan", about: "gratis AI-scan (hoofd-CTA)" },
  { url: "/diensten/ai-automatisering", about: "AI-automatisering" },
  { url: "/diensten/ai-agents", about: "AI-agents bouwen" },
  { url: "/diensten/ai-strategie", about: "AI-strategie" },
  { url: "/diensten/ai-marketing", about: "AI-marketing" },
  { url: "/trainingen", about: "AI-trainingen 1-op-1 en in-company" },
  { url: "/prijzen", about: "prijzen en pakketten" },
  { url: "/diensten/ai-marketing/kampen", about: "AI-marketing Kampen" },
  { url: "/diensten/ai-marketing/zwolle", about: "AI-marketing Zwolle" },
  { url: "/over-mij", about: "over Thysja" },
];

export const siteReadConfigured = () => Boolean(env("SITE_SUPABASE_URL") && env("SITE_SUPABASE_ANON_KEY"));
export const sitePublishConfigured = () => Boolean(env("SITE_SUPABASE_URL") && env("SITE_BLOG_SECRET"));
export const siteLiveConfigured = () => Boolean(env("SITE_SUPABASE_SERVICE_ROLE_KEY"));

export async function listSitePosts(): Promise<SitePost[]> {
  if (!siteReadConfigured()) return [];
  const db = createClient(env("SITE_SUPABASE_URL"), env("SITE_SUPABASE_ANON_KEY"), { auth: { persistSession: false } });
  const { data, error } = await db
    .from("blog_posts")
    .select("slug, title, excerpt, tags, published_at")
    .eq("published", true)
    .is("deleted_at", null)
    .order("published_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(`Blogs lezen mislukt: ${error.message}`);
  return (data ?? []) as SitePost[];
}

export interface PublishResult {
  id: string;
  slug: string;
  live: boolean;
  url: string;
  adminUrl: string;
}

export async function publishBlog(item: InboxItem): Promise<PublishResult> {
  const blog = item.payload.blog;
  if (!blog) throw new Error("Geen blog in dit item");
  const res = await fetch(`${env("SITE_SUPABASE_URL").replace(/\/$/, "")}/functions/v1/create-blog-draft`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${env("SITE_BLOG_SECRET")}` },
    body: JSON.stringify({
      titel: item.title,
      slug: blog.slug,
      inhoud: blog.markdown,
      excerpt: blog.excerpt,
      tags: blog.tags,
      auteur: "Thysja",
      seo_titel: blog.seo_title,
      seo_meta_description: blog.seo_description,
      cover_alt: item.title,
    }),
  });
  const json = (await res.json().catch(() => ({}))) as { id?: string; slug?: string; error?: string; detail?: string };
  if (!res.ok || !json.id || !json.slug) throw new Error(`Website: ${res.status} ${json.error ?? ""} ${json.detail ?? ""}`.trim());

  const adminUrl = `https://marketbooster.nl/admin/blog?edit=${json.id}`;
  const url = `https://marketbooster.nl/blog/${json.slug}`;
  if (!siteLiveConfigured()) return { id: json.id, slug: json.slug, live: false, url, adminUrl };

  const admin = createClient(env("SITE_SUPABASE_URL"), env("SITE_SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
  const { error } = await admin
    .from("blog_posts")
    .update({ published: true, published_at: new Date().toISOString(), reading_minutes: readingMinutes(blog.markdown) })
    .eq("id", json.id);
  if (error) throw new Error(`Concept staat klaar, maar live zetten mislukte: ${error.message}`);
  return { id: json.id, slug: json.slug, live: true, url, adminUrl };
}
