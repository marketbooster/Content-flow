# Marketbooster Mission Control

Eén mobiel-eerst web-app (PWA) waarin acht AI-agents elke nacht marketingacties klaarzetten. Thysja (eigenaar Marketbooster) keurt 's ochtends in 15–20 minuten goed en verstuurt met één tik. Doel: elke werkdag zichtbaar gas op leads, SEO en social.

Positionering: AI geeft MKB tijd terug, vervangt geen personeel. Toon: direct, warm, Nederlands, je/jij, korte zinnen.

## De vijf spelregels (hard, in code afgedwongen)

1. **Niets gaat naar buiten zonder Thysja's tik.** Agents maken alleen `inbox_items`. Alleen de dispatcher (`lib/dispatch/dispatcher.ts`) verstuurt, alleen na status `approved`. In de database: trigger `guard_sent_status` laat alleen de service role een item op `sent` zetten; `dispatch_log` is alleen-lezen voor de gebruiker.
2. **Elk concept is af.** Volledige tekst, slides, script. Goedkeuren = klaar.
3. **Eén brein.** Alle agents krijgen `brainContext(brain)` als system prompt (`lib/ai.ts`).
4. **Elke afwijzing leert.** Weg vraagt een reden → `brain.learnings` (via `append_learning`).
5. **Max 20 kaarten per dag.** Vandaag toont er max 20, gesorteerd op `priority`. Chief rangschikt (sprint 5).

## Vangrails (`lib/guardrails.ts`, getest)

Daglimiet per kanaal · verzendvenster werkdagen 08:00–17:30 Europe/Amsterdam · geen tweede één-op-één-benadering binnen 14 dagen · nooit naar klanten · afmeldlijst (ook op domein) · noodknop `settings.paused` · logboek per verzending · maandplafond API-kosten (melding bij 80%, stop bij 100%) · koude e-mail standaard uit · 5 sec ongedaan maken (`send_after`).

## De acht agents (Europe/Amsterdam)

| Agent | Wanneer | Sprint | Status |
|---|---|---|---|
| Scout (kansen-radar) | dagelijks 05:00 | 4 | — |
| Hunter (acquisitie) | dagelijks 05:30 | 3 | — |
| Ranker (SEO) | ma 05:00 brief · vr 05:00 linkkans | 1 | **gebouwd** (naar voren gehaald) |
| Creator (social) | dagelijks 06:00 | 1 | **gebouwd** |
| Listener (engagement) | dagelijks 06:30 | 2 | — |
| Nurturer (e-mail) | dagelijks 07:00 | 2 | — |
| Analyst (rapport) | vr 16:00 | 5 | — |
| Chief (ochtendbriefing) | dagelijks 07:15 | 5 | — |

Elke agent = `prompts/<agent>*.md` + Zod-schema voor JSON-output + `runAgent()` wrapper (pauze, budget, `agent_runs`-logging). Nieuwe agent: voeg hem toe aan `IMPLEMENTED` in `lib/cron.ts` en aan `runAgentNow`. Een agent draait pas op schema als hij handmatig getest is én in Profiel aangezet (`settings.cron_enabled`).

Modellen: `CLAUDE_MODEL_WRITE` (standaard claude-opus-5-5) voor schrijven, `CLAUDE_MODEL_SCAN` (standaard claude-haiku-5-5) voor scannen/sorteren.

## Architectuur

- Next.js 16 App Router + TypeScript + Tailwind 4, PWA. Hosting Vercel. `proxy.ts` (= middleware in Next 16) doet de optimistische login-check; elke server action roept `requireOwner()`.
- Supabase: Postgres + Auth (magic link, alleen `OWNER_EMAIL` / tabel `app_owner`) + RLS op alle tabellen.
- **Afwijking van het oorspronkelijke ontwerp:** agents draaien niet in Supabase Edge Functions maar als server-code in de Next-app, aangeroepen door **één** pg_cron-job (`supabase/migrations/0002_cron.sql`) die elke 5 min `/api/cron/tick` aanroept. De app bepaalt zelf in Amsterdamse tijd wat aan de beurt is (DST-proof). Reden: één codebase, gedeelde schema's en vangrails.
- `lib/db/repo.ts` is de enige toegangslaag. `supabase.ts` in productie; `memory.ts` (JSON in `.data/`) is **demo-modus** als de Supabase-variabelen ontbreken.
- Dispatcher-adapters (`lib/dispatch/adapters.ts`): `api` (1 klik), `manual` (1-tap: klembord + app openen, daarna bevestigen), `none` (nog niet gekoppeld).
- Carrousel-slides: `app/api/slides/[id]/[index]` rendert HTML → PNG (of JPEG voor Instagram) in Poppins; publiek met HMAC-handtekening.

## Tabellen

`brain`, `settings`, `inbox_items`, `dispatch_log`, `leads`, `lead_events`, `content_ideas`, `calendar`, `lead_magnets`, `downloads`, `keywords`, `opportunities`, `suppression`, `agent_runs`, `app_owner`. Schema in `supabase/migrations/0001_mission_control.sql`.

## Ranker en de website

marketbooster.nl is een Lovable-project ("Marketbooster") met een eigen Supabase. Tabel `blog_posts` (body in markdown of HTML). De blogpagina maakt zelf: inhoudsopgave uit `##`, FAQPage-schema uit `## Veelgestelde vragen` + `### vraag`, BlogPosting-schema. Ranker schrijft precies in die structuur.

- Lezen: gepubliceerde blogs via anon key (`SITE_SUPABASE_ANON_KEY`), voor interne links en dubbel-check (kannibalisatie).
- Publiceren: bestaande Edge Function `create-blog-draft` (Bearer = `MAKE_WEBHOOK_SECRET` van de site) → concept + automatische cover. Met `SITE_SUPABASE_SERVICE_ROLE_KEY` zet de dispatcher hem direct live.
- Flow: ma blogbrief (webonderzoek via Claude web_search + brief) → "Schrijf deze blog" → volledige blog met SEO-check (`lib/seo.ts`) → kaart op woensdag → Publiceer → LinkedIn-post + carrousel in de swipe-stapel. Vr: linkkans als 1-tap e-mail (mailto) tot Gmail gekoppeld is.
- Let op: de site heeft een eigen cron `weekly-blog-idea` (regelgeving → conceptblog via Gemini). Uitzetten zodra Ranker live is, anders dubbele blogs.
- Search Console volgt; tot dan kiest Ranker uit doelzoekwoorden (Profiel) en de contentbank.

## Huisstijl app

Wit #FFFFFF, vlakken #F7F7F8, tekst #151A28 / #6B7080, randen max 1px #EDEDF0, geen schaduwen. **Roze #EB1971 alleen voor Verzend en de voortgangsbalk** (en zachte lege-slot-vakjes in de kalender, zoals het ontwerp vraagt). Geist (titel 28/600, kaart 20/600, body 16/400 lh 1.5, meta 13/500), Geist Mono voor getallen. Poppins alleen voor content die naar buiten gaat. Hoeken 16px kaarten, 12px knoppen, 8px-raster, Lucide 1.5, tikvlakken ≥ 44px. Donker volgt systeem. Animaties 150–200 ms. Eén ding per scherm.

Navigatie: Vandaag / Kalender / Leads. Agents, brein, koppelingen, kosten, noodknop en logboek achter de profielknop (`/profiel`).

## Werkwijze

- Werk in sprints. Na elke sprint: wat werkt, wat Thysja moet doen (keys, accounts), wat de volgende sprint is.
- `npm test` (vangrails, slots, dispatcher), `npm run typecheck`, `npm run build`.
- Test elke agent eerst met **Run nu** voordat de cron aangaat. Niets mag automatisch posten of mailen zonder goedkeuring in de app.

## Sprintstatus

- **Sprint 1 — Lanceerplatform: gebouwd.** Schema + RLS, magic link, brein-editor, goedkeur-inbox (Verzend/Bewerk/Herschrijf/Later/Weg, swipe, bulk met bevestiging, 5 sec ongedaan maken), Creator (10 ideeën + volledige assets), swipe-kalender met ritme en variatieregels, weekweergave met slepen, slides als PNG/JPEG, teleprompter, dispatcher met Buffer-, LinkedIn Share- en Instagram-adapters, agent-runs en kostentegel.
- Open in sprint 1: pushmeldingen (komen met Chief in sprint 5); LinkedIn-carrousel als PDF-documentpost (nu 1-tap); Instagram Reel automatisch publiceren na video-upload (nu 1-tap); Buffer-GraphQL-velden verifiëren bij koppelen.
- Ranker (SEO/blog) is naar voren gehaald en gebouwd; Search Console-koppeling en pagina-updates van dalende pagina's volgen.
- Sprint 2 — Script van de week · Sprint 3 — Hunter · Sprint 4 — Search Console, Scout, lokale SEO (Google Bedrijfsprofiel, reviews) · Sprint 5 — Chief + Analyst.
