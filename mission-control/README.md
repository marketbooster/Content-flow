# Mission Control

Marketbooster Mission Control: acht AI-agents zetten 's nachts acties klaar, jij keurt 's ochtends goed en drukt op verzenden. Ontwerp en spelregels: [`CLAUDE.md`](CLAUDE.md).

## Meteen proberen (demo-modus, geen keys nodig)

```bash
cd mission-control
npm install
npm run dev          # http://localhost:3000
```

Zonder Supabase-variabelen draait de app lokaal met voorbeeldkaarten (opgeslagen in `.data/`). Zonder Claude-sleutel maakt Creator demo-ideeën. Verzenden staat uit tot een kanaal gekoppeld is: de app doet nooit alsof iets verstuurd is.

```bash
npm test             # vangrails, kalenderslots, dispatcher
npm run typecheck
npm run build
```

## Live zetten

1. **Supabase**: maak een nieuw project (apart van de website). Voer in de SQL-editor `supabase/migrations/0001_mission_control.sql` uit, daarna:
   ```sql
   insert into app_owner values ('jouw@mailadres.nl');
   ```
   Zet in Authentication → URL Configuration de Site URL op je app-URL en voeg `<APP_URL>/auth/callback` toe aan Redirect URLs.
2. **Vercel**: importeer de repo, Root Directory `mission-control`. Zet alle variabelen uit `.env.example` (genereer `CRON_SECRET` en `SLIDE_SIGNING_SECRET` met `openssl rand -hex 32`).
3. **Cron**: vul in `supabase/migrations/0002_cron.sql` je `APP_URL` en `CRON_SECRET` in en voer het uit.
4. Log in, vul het **merkbrein** (Profiel), druk bij Creator op **Run nu**, keur een paar ideeën goed. Werkt alles, zet Creator dan **op schema**.

## Wat je moet aanvragen

| Wat | Waar | Waarom |
|---|---|---|
| Instagram → Business- of Creator-account, gekoppeld aan een Facebook-pagina | Instagram-app → Instellingen → Accounttype | Graph API werkt alleen zo. Langste doorlooptijd: **eerst doen**. |
| Meta-app met `instagram_content_publish` (+ later `instagram_manage_comments`, `instagram_manage_messages` voor comment-to-DM) | developers.facebook.com | Posten en (sprint 2) codewoord-DM's. App Review duurt dagen tot weken. |
| Buffer-account met LinkedIn-profiel gekoppeld + API-token | buffer.com | Snelste route om op LinkedIn te posten. |
| *Of:* LinkedIn-app met product "Share on LinkedIn" (scope `w_member_social`) | linkedin.com/developers | Gratis alternatief voor Buffer, met goedkeuring. |
| Claude API-sleutel met tegoed | console.anthropic.com | Los van een Claude Pro-abonnement. |
| Google Search Console + GA4 API-toegang | console.cloud.google.com | Sprint 4 (Ranker). Nu al aanvragen. |
| Gmail API op info@ en Brevo API-sleutel | Google Cloud / Brevo | Sprint 2 (Nurturer, nieuwsbrief). |
