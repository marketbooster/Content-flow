# ContentFlow · Seasonal Intelligence & AI Content Council

Analyse, ontwerp en implementatieplan (module F). Stand: 23 november 2026.

## 0. Uitgangssituatie

Er bestond nog geen ContentFlow-code. De GitHub-repo `marketbooster/Content-flow` was leeg, en in Lovable en de Claude-artifacts stond geen ContentFlow-project. In overleg is besloten om **opnieuw te beginnen in deze repo**. Onderdelen die in de briefing als "bestaand" staan (Swipe Studio, Format Library, AI Content Studio, analytics, Creator Business Hub) zijn daarom alleen gebouwd voor zover deze uitbreiding ze nodig heeft. Waar ze ontbreken, staat dat hieronder.

## 1. Gap-analyse

| Onderdeel | Status na deze oplevering | Opmerking |
|---|---|---|
| A1 Dynamische inhaakkalender | ✅ MVP | 38 beheerde momenten. Vaste datums, rekenregels (Pasen, Moederdag, Koningsdag, Black Friday) en per jaar geverifieerde datums. Betrouwbaarheidsstatus per voorkomen. |
| A1 Schoolvakanties per regio | ⚠️ Deels | Alleen kerstvakantie 2026/27, gemarkeerd als *te verifiëren*. Rijksoverheid was vanuit de bouwomgeving niet bereikbaar. Fase 2: importer voor de open-data-API plus handmatige verificatie. |
| A1 Actuele trends | ✅ Bewust leeg | Er worden geen trends meegeleverd. Een gebruiker kan een trend alleen toevoegen met bron-URL, vaststellingsdatum en vervaldatum, en verlopen trends verdwijnen automatisch. |
| A2 Contentkansen per moment | ✅ MVP | 44 handgeschreven ideeën voor FitMetThies over 15 momenten, plus 11 tijdloze ideeën. Gerangschikt op pijlergewicht, met uitgesloten onderwerpen weggefilterd. |
| A3 Vooruitplannende AI | ✅ | 5 fases (8/6/3/1/0 weken), instelbaar per creator en per moment. Maximaal N meldingen per week, één per moment, nooit twee keer dezelfde. |
| A4 Seasonal Swipe | ✅ | Swipen (sleep, knoppen of pijltjestoetsen), bewaren, ongedaan maken, inplannen op de ideale datum of zelf gekozen, batch-inplannen. Variaties maak je via de Studio. |
| A5 Contentmix | ✅ | Signaleert eenzijdige formats, terugkerende onderwerpen, onbenutte kansen, te late planning en content die niet past. Wijzigt nooit zelf iets. |
| B1 Twee providers | ✅ | Officiële SDK's (`@anthropic-ai/sdk`, `openai`), alleen server-side, uitwisselbaar via één `AIProvider`-interface. |
| B2/B3 Drie modi + Council-workflow | ✅ | Snel (1 aanroep), Slim (2–3) en Council (5–7). Gebouwd en getest met test-doubles. **Nog niet getest met echte sleutels.** |
| B4 Betrouwbaarheid | ⚠️ Deels | AI mag geen calorieën als feit noemen. Elk voorstel blijft *niet geverifieerd*. Echte voedingswaardeberekening (NEVO-tabel) volgt in fase 3. |
| B5 Kostenbeheersing | ✅ | Kostenregistratie per stap, maandbudget met harde stop vóór de aanroep, Council-maandlimiet, cache (24 u), rate limit, timeouts, retries en fallback. |
| B6 Transparantie / AI Review | ✅ | Gebruikte modellen, wijzigingen met reden, aannames, ontbrekende gegevens, te controleren punten, verschillen en kosten per stap. |
| C Persoonlijke strategie | ✅ | 8 pijlers met gewichten. Relevantie wordt automatisch per moment berekend. Momenten zijn uit te zetten en onderwerpen uit te sluiten. |
| D Datamodel | ✅ Ontwerp | `supabase/migrations/0001_…sql`, getest op Postgres 16, inclusief RLS-isolatie en ontdubbeling. De MVP gebruikt nog lokale opslag. |
| E UX | ✅ | Radar, kalender met inhakers en filters, momentpagina, Swipe, Studio met modusselector, AI Review, instellingen. Mobile-first. |
| Extra: "Maak mijn maandplanning" | ✅ | Deterministische planner (gratis en uitlegbaar). Daarna swipen, inplannen en per item script en shotlist maken via AI. |
| Accounts / multi-user | ❌ | Fase 2 (Supabase Auth en het datamodel hierboven). |
| Analytics / prestatiegegevens | ❌ | Geen koppeling met Instagram of TikTok. Prestaties kun je handmatig in de briefing plakken. |
| Format Library, Creator Business Hub | ❌ | Vallen buiten deze uitbreiding. De datamodellen zijn wel voorbereid (`commercial`-vlag, controle van briefingvoorwaarden). |

## 2. UX-ontwerp

Mobile-first, met een onderbalk met 5 tabs (op desktop een zijbalk).

1. **Radar (dashboard).** Bovenaan de meldingen voor de huidige voorbereidingsfase (maximaal 3), daarna een knop voor *Maak mijn maandplanning*, een mini-maandkalender, de lijst "Aankomende inhakers" (relevantie, fase, aantal ideeën, aantal gepland) en maximaal 3 contentmix-tips.
2. **Kalender.** Maandraster met alleen momenten boven een instelbare relevantiedrempel. Lange periodes (een maand of seizoen) krijgen alleen een markering op de startdag, zodat de kalender niet volloopt. Je kunt filteren op type en relevantie. Een dag aantikken toont de momenten en content van die dag.
3. **Momentpagina.** Datum, betrouwbaarheid, bron, relevantie met uitleg, een tijdlijn van de voorbereiding (de actieve fase gemarkeerd), creatieve invalshoeken, ideeën, gekoppelde content en een knop "niet meer voorstellen".
4. **Swipe.** Tabbladen *Seasonal* en *Bewaard*, met momentkaartjes horizontaal. Elke kaart toont het format, de pijler, de hook, de ideale publicatiedatum, de productietijd en waarschuwingen (voedingswaarden, commercieel).
5. **Studio.** Briefing (vooraf ingevuld vanuit een moment, idee of item), keuze tussen de drie modi met het maximale aantal aanroepen en de maximale kosten, status van de providers en het budget. Het resultaat heeft een inklapbaar blok "Transparantie" en een link naar **AI Review**. De vergelijking staat daar bewust op een apart scherm.
6. **Instellingen.** Gewicht per pijler, uren per week, merkstem, regio, uitgesloten onderwerpen, meldingen (aantal, drempel, fases, dagen vooraf), uitgezette momenten, en eigen momenten en trends (een trend vraagt verplicht een bron).

## 3. Databasevoorstel

Zie `supabase/migrations/0001_seasonal_intelligence.sql`. De kern:

- `seasonal_events` (regel als JSONB, `date_kind`, bron, `last_verified`, `expires_at`, `creator_id` NULL betekent gedeeld) → `event_occurrences` (PK `event_id + start_date`, dus geen dubbele kalenderitems).
- `creator_event_relevance`, `idea_templates`, `seasonal_content_suggestions` (uniek per creator, voorkomen en template), `idea_feedback`.
- **Eén planningsbron:** `content_items`, met een unieke index op creator, template en voorkomen. Er is geen tweede planner.
- `content_plans`, `notification_preferences`, `notifications_sent` (voorkomt dubbele meldingen).
- AI: `ai_provider_configs` (alleen model en prijs, **geen sleutels**), `ai_budgets`, `ai_generation_jobs`, `ai_reviews` (één rij per stap met tokens en kosten), `user_feedback`.
- RLS: alles is per creator afgeschermd via `owns_creator()`. De gedeelde kalender is alleen leesbaar en AI-jobs schrijft alleen de server (service role).

Getest op Postgres 16, met een stub van het `auth`-schema:

- Een dubbel idee wordt geweigerd.
- Een trend zonder bron wordt geweigerd.
- Gebruiker B ziet 0 items van A en kan niet namens A schrijven.
- De gedeelde kalender is leesbaar maar niet te wijzigen.

## 4. API-architectuur

```
Browser (React) ──/api──► Node-server (Hono)
                           ├─ GET  /api/ai/status      providers, budget, maximale kosten per modus
                           ├─ POST /api/ai/generate    {mode, primary, brief} → AIJob
                           ├─ GET  /api/ai/jobs[/:id]  voor het AI Review-scherm
                           └─ Orchestrator
                                ├─ AnthropicProvider  (messages.parse + Zod, effort medium,
                                │                      server-side fallback bij weigering)
                                ├─ OpenAIProvider     (responses.parse + Zod; model en prijs via .env)
                                ├─ Ledger             (tokens, kosten, maandbudget, Council-limiet)
                                ├─ cache (24 u op briefing-hash), rate limiter
                                └─ timeouts (120 s) + 2 SDK-retries + provider-fallback
```

- Beide providers leveren **hetzelfde Zod-schema** (structured outputs), zodat voorstellen 1-op-1 te vergelijken zijn.
- Council: twee voorstellen parallel → kruisreview (anoniem, parallel) → verschillen berekend **in code** → synthese → maximaal één extra review → eventueel een laatste verbetering. In het slechtste geval 7 aanroepen.
- De sleutels staan alleen in `.env` op de server. De frontend bevat geen sleutels of provider-SDK's.
- Gesimuleerde antwoorden bestaan alleen in `server/ai/orchestrator.test.ts`. Zonder sleutels geeft de app een duidelijke foutmelding in plaats van nep-output.

## 5. Kostenraming

Prijzen voor Claude Opus 5.5: $4 per miljoen input-tokens en $20 per miljoen output-tokens. Voor OpenAI vul je de prijs zelf in `.env` in; zonder prijs draait OpenAI niet.

Aannames per aanroep: ±2.000 input-tokens en ±3.000–4.000 output-tokens, inclusief denkwerk op effort *medium*. Dat is een **schatting**; meet het in de eerste week met de ingebouwde kostenregistratie.

| Modus | Aanroepen | Schatting (alleen Claude) | Harde bovengrens in de app |
|---|---|---|---|
| Snel | 1 | ± $0,07–0,09 | $0,34 |
| Slim | 2–3 | ± $0,15–0,27 | $1,03 |
| Expert Council | 5–7 | ± $0,40–0,65 + OpenAI-deel | afhankelijk van de OpenAI-prijs |

Voorbeeldmaand: 60× Snel, 20× Slim en 8× Council komt op ongeveer **$15–20** (exclusief het OpenAI-deel van de Council). Het standaardbudget is $25 per maand en is instelbaar. De seizoenskalender, ideeën, meldingen, contentmix en maandplanning kosten **niets**, want die draaien zonder AI.

Besparingsopties (jouw keuze, niet standaard):

- `ANTHROPIC_MODEL=claude-sonnet-5-5`: de helft van de prijs.
- Batch-verwerking voor de maandplanning: ongeveer 50% goedkoper.

## 6. Implementatieplan in kleine fases

| Fase | Inhoud | Status |
|---|---|---|
| 1 | Seasonal Intelligence MVP: kalender-engine, catalogus, relevantie, meldingen, ideeën, Swipe, Radar, kalender, maandplanning | ✅ deze oplevering |
| 2 | AI Council: providers, drie modi, kosten, cache, AI Review | ✅ gebouwd · ⏳ testen met echte sleutels |
| 3 | Betrouwbaarheid: voedingswaarde uit NEVO-gegevens per ingrediënt, importer voor schoolvakanties plus beheerscherm voor verificatie | gepland |
| 4 | Supabase: auth, migratie van localStorage naar tabellen, jobs vanuit de server opslaan per creator | gepland |
| 5 | Pushmeldingen (PWA en e-mail) met dezelfde beperking per week, plus een jaarlijkse job voor de voorkomens | gepland |
| 6 | Prestatiegegevens (Instagram/TikTok API) en Creator Business Hub (brand deals, exclusiviteitscheck) | gepland |

## 7. Testscenario's

Geautomatiseerd (`npm test`, 40 tests):

- **Datums:** Pasen 2019–2038, Moederdag, Vaderdag, wintertijd, Koningsdag op zondag (2025 → 26 april), "vandaag" in de NL-tijdzone, rekenen over de zomertijdwissel.
- **Voorkomens:** Black Friday en Cyber Monday 2026, Carnaval, Hemelvaart en Pinksteren uit de paasdatum, maand-events, de jaargrens (kerstvakantie), geen dubbelingen, betrouwbaarheidslabels, trends zonder bron, verlopen trends.
- **Relevantie en meldingen:** Sinterklaas en Kerst ≥ 85%, uitgezette momenten 0%, regionale korting, Sinterklaas 12 dagen vooraf staat in de productiefase, maximaal N meldingen per week en nooit dubbel, meldingen uit levert niets op.
- **Ideeën:** afgewezen en ingeplande ideeën worden ontdubbeld, uitgesloten onderwerpen gefilterd.
- **Mix:** signalen voor eenzijdige formats, terugkerende pijlers, onbenutte kansen en content ná het moment; de invoer blijft ongewijzigd.
- **Maandplanning:** binnen de capaciteit, minstens 3 pijlers, geen dubbelingen, alleen datums in de doelmaand, en weinig uren wordt gerespecteerd.
- **Orchestrator:** aantal aanroepen per modus, Slim verbetert alleen bij een zwakke review, Council vindt verschillen, Council weigert zonder tweede provider, fallback bij uitval, budget stopt vóór de kosten, cache.

Handmatig nog te doen:

1. Met echte API-sleutels: één run per modus en provider. Controleer de JSON-structuur, de kosten in de ledger tegen de console van de provider, en de timeout bij een trage Council.
2. Een sleutel zonder tegoed: de fout moet duidelijk zijn en de fallback naar de andere provider moet werken.
3. Budget op $0,50 zetten: het moet geblokkeerd worden met een uitleg.
4. Mobiel (iOS Safari): swipe-gebaren en datumvelden.
5. Schermlezer en toetsenbord: swipen met pijltjestoetsen, focus zichtbaar.

## 8. Beveiligings- en privacyrisico's

| Risico | Maatregel |
|---|---|
| Uitlekken van API-sleutels | Alleen server-side in `.env` (staat in `.gitignore`), nooit in de bundle of database. In productie via secrets of Vault. |
| Kostenexplosie of misbruik | Maandbudget met controle vóór de aanroep, Council-limiet, rate limit, cache, een beperkte invoergrootte (Zod) en maximaal 7 aanroepen. **Fase 4:** de server eist login. Nu is `/api/ai/generate` alleen geschikt voor lokaal gebruik. |
| Prompt-injectie via de briefing | Output staat vast in een strikt schema, er worden geen tools of acties uitgevoerd, en de output gaat altijd eerst naar de gebruiker. |
| Privacy (kinderen, gezondheid/PCOS) | Ideeën wijzen op "alleen wat je wilt delen". AI-prompts verbieden medische claims. Gezondheidsgegevens zijn bijzondere persoonsgegevens: deel in briefings niet meer dan nodig. Aanbieders verwerken de briefing; controleer de dataretentie en of er een verwerkersovereenkomst is. |
| Onjuiste feiten (calorieën, trends, kortingen) | Er is geen calorie-veld in het AI-schema, elk voorstel is *niet geverifieerd*, trends vragen een bron, en commerciële ideeën dragen een waarschuwing over de voorwaarden. |
| Reclameregels (Reclamecode Social Media) | Commerciële en affiliate-ideeën vermelden expliciet dat ze gelabeld moeten worden. |
| Scheiding tussen accounts | RLS per creator, getest op Postgres. De server gebruikt de service role alleen voor AI-jobs. |
| Lokale opslag (MVP) | De planning staat in localStorage van de browser: niet gedeeld, niet versleuteld. Wissen kan via Instellingen. |
