# ContentFlow

Een slimme contentassistent voor creators. Hij denkt vooruit over seizoensmomenten, stelt ideeën voor die bij je passen en helpt je van idee tot gepost. Jij blijft beslissen.

**Plannen**

- **Vandaag:** wat je vandaag moet filmen of posten, een countdown naar het volgende grote moment, en waarschuwingen.
- **Seasonal Radar en inhaakkalender:** vaste, berekende en te verifiëren datums, met meldingen per voorbereidingsfase.
- **Kalender:** week- en maandweergave; content versleep je naar een andere dag.
- **Seasonal Swipe en "Maak mijn maandplanning".**

**Maken**

- **Productiebord:** idee → script → gefilmd → bewerkt → gepost, met slepen.
- **Opnamedag-planner:** bundelt je video's per locatie tot één draaiboek, binnen de tijd die je hebt.
- **AI Studio:** Snel, Slim of Expert Council (Claude en OpenAI).
- **Hook-generator:** 5 hooks, een caption en hashtags in je merkstem.

**Zakelijk**

- **Samenwerkingen-tracker:** deals van Influentials, Join of direct, met deadlines, vergoedingen en waarschuwingen bij exclusiviteitsconflicten.

**App**

- Installeerbaar op je telefoon (PWA), in FitMetThies-huisstijl, met licht en donker thema.

Analyse, ontwerp, kostenraming, fases, testscenario's en risico's staan in [`docs/ANALYSE-EN-PLAN.md`](docs/ANALYSE-EN-PLAN.md).

## Starten

```bash
npm install
cp .env.example .env     # optioneel: API-sleutels voor de AI-functies
npm run dev              # web op http://localhost:5173, API op :8787
npm test                 # unit-tests
npm run typecheck:tests  # typecontrole van de tests
```

Zonder API-sleutels werkt alles behalve de AI-functies (Studio en hooks).

Let op: een ChatGPT Plus- of Claude Pro-abonnement geeft **geen** API-toegang. Je hebt aparte API-sleutels nodig, met tegoed, van console.anthropic.com en platform.openai.com.

Online zetten, met wachtwoord en AI: zie [`docs/ONLINE-ZETTEN.md`](docs/ONLINE-ZETTEN.md).

## Structuur

```
src/domain/      pure logica (datums, kalender, relevantie, ideeën, mix, maandplanner, opnamedag, deals) + tests
src/pages/       Vandaag, Radar, Kalender, Bord, Swipe, Opnamedag, Samenwerkingen, Studio, Content, Instellingen, …
src/state/       opslag in de browser + migratie van oudere data
server/          Hono-API, AI-providers, orchestrator (Snel/Slim/Council/hooks), kostenregistratie, wachtwoord
supabase/        doel-datamodel met RLS (de MVP slaat nog lokaal op)
public/          app-iconen, manifest en service worker (installeerbare app)
```
