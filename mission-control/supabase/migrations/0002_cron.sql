-- Eén cron-job: elke 5 minuten een tik naar de app.
-- De app bepaalt zelf (in Europe/Amsterdam, dus zomer-/wintertijd-proof) welke agents aan de beurt zijn
-- en verstuurt goedgekeurde items waarvan het moment is aangebroken.
-- Agents draaien alleen op het schema als je ze per stuk aanzet in Profiel → Agents (na een handmatige 'Run nu').
--
-- Voer dit pas uit als de app online staat. Vervang de twee placeholders:
--   <APP_URL>      bijv. https://mission.marketbooster.nl
--   <CRON_SECRET>  dezelfde waarde als in je Vercel-omgevingsvariabelen

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'mission-control-tick',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := '<APP_URL>/api/cron/tick',
    headers := jsonb_build_object('content-type', 'application/json', 'x-cron-secret', '<CRON_SECRET>'),
    body := '{}'::jsonb,
    timeout_milliseconds := 290000
  );
  $$
);
