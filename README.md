# ContentFlow

Een slimme contentassistent voor creators. Hij denkt vooruit over seizoensmomenten, stelt ideeën voor die bij je passen en laat desgewenst Claude en OpenAI samen een voorstel uitwerken. Jij blijft beslissen.

**Seasonal Intelligence**

- Een beheerde inhaakkalender met vaste, berekende en te verifiëren datums.
- Relevantie per creator.
- Meldingen per voorbereidingsfase, met een maximum per week.
- Seasonal Swipe.
- Signalen over je contentmix.
- **Maak mijn maandplanning**.

**AI Content Council**

- Drie modi: Snel, Slim en Expert Council.
- Server-side aanroepen naar Anthropic en OpenAI.
- Kosten- en budgetbewaking.
- Een AI Review-scherm.

Analyse, ontwerp, kostenraming, fases, testscenario's en risico's staan in [`docs/ANALYSE-EN-PLAN.md`](docs/ANALYSE-EN-PLAN.md).

## Starten

```bash
npm install
cp .env.example .env     # optioneel: API-sleutels voor de AI Studio
npm run dev              # web op http://localhost:5173, API op :8787
npm test                 # 44 unit-tests
```

Online zetten, met wachtwoord en AI: zie [`docs/ONLINE-ZETTEN.md`](docs/ONLINE-ZETTEN.md).

Zonder API-sleutels werkt alles behalve de AI Studio: kalender, ideeën, swipen, meldingen en maandplanning.

Let op: een ChatGPT Plus- of Claude Pro-abonnement geeft **geen** API-toegang. Je hebt aparte API-sleutels nodig, met tegoed, van console.anthropic.com en platform.openai.com. Vul voor OpenAI ook het model en de prijs per miljoen tokens in; zonder prijs draait OpenAI niet, omdat de kosten dan niet te bewaken zijn.

## Structuur

```
src/domain/      pure logica (datums, kalender, relevantie, ideeën, mix, maandplanner) + tests
src/pages/       Radar, Kalender, Moment, Swipe, Maandplanning, Studio, AI Review, Content, Instellingen
server/          Hono-API, AI-providers, orchestrator (Snel/Slim/Council), kostenregistratie
supabase/        doel-datamodel met RLS (de MVP slaat nog lokaal op)
```
