# ContentFlow online zetten (Railway)

Met deze stappen draait ContentFlow inclusief de AI Studio op een eigen webadres, achter een wachtwoord. Reken op ongeveer 15 minuten.

## Waarom Railway

- Draait de Node-server die je API-sleutels veilig bewaart. Een gewone statische site kan dat niet.
- Heeft een **blijvend volume**, zodat de kostenregistratie en het maandbudget een herstart overleven.
- Het Hobby-abonnement kost $5 per maand, inclusief $5 aan gebruik. Volumes kosten $0,15 per GB per maand; ContentFlow heeft minder dan 1 GB nodig. Controleer de actuele prijzen op [railway.com/pricing](https://railway.com/pricing).

De AI-kosten (Anthropic en OpenAI) komen daar los bij. Zie de kostenraming in `ANALYSE-EN-PLAN.md`.

## Wat je nodig hebt

1. Een account op railway.com. Log in met GitHub.
2. Een **Anthropic API-sleutel** met tegoed, van console.anthropic.com. Dit is iets anders dan een Claude Pro-abonnement.
3. Optioneel, voor Expert Council: een **OpenAI API-sleutel** met tegoed (platform.openai.com), de naam van het model dat je wilt gebruiken, en de prijs per miljoen tokens van dat model.
4. Een sterk wachtwoord voor de app, van minimaal 12 tekens.

## Stappen

1. In Railway: **New Project → Deploy from GitHub repo**. Kies `marketbooster/Content-flow`.
2. Kies onder de service-instellingen bij **Source** de branch `claude/contentflow-seasonal-ai-council-dv9ayf`, tot deze is samengevoegd met je hoofdbranch.
3. Railway herkent de Node-app zelf. Het draait `npm run build` en daarna `npm start`; je hoeft niets in te stellen.
4. Ga naar **Variables** en voeg toe:

   | Variabele | Waarde |
   |---|---|
   | `NODE_ENV` | `production` |
   | `APP_PASSWORD` | jouw wachtwoord (minimaal 12 tekens) |
   | `ANTHROPIC_API_KEY` | je Anthropic-sleutel |
   | `DATA_DIR` | `/data` |
   | `AI_MONTHLY_BUDGET_USD` | bijv. `25` |
   | `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_INPUT_USD_PER_MTOK`, `OPENAI_OUTPUT_USD_PER_MTOK` | alleen voor Expert Council |

5. Klik met rechts op de service → **Attach volume**, met mount path `/data`.
6. Ga naar **Settings → Networking → Generate Domain**. Je krijgt een adres zoals `contentflow-production.up.railway.app`.
7. Open dat adres. De browser vraagt om een gebruikersnaam (vul iets willekeurigs in) en je wachtwoord.

## Controleren of het werkt

- Ga naar **Studio**. Bij "Claude" moet een groen label met de modelnaam staan.
- Doe één generatie in de modus **Snel**. Controleer na afloop in de Anthropic-console of de kosten ongeveer overeenkomen met wat ContentFlow onder **Transparantie** toont.

## Goed om te weten

- **Je planning staat nog in je browser.** De server bewaart alleen de AI-kosten en AI-resultaten. Planning op je telefoon en je laptop is dus nog niet gedeeld; dat komt in fase 4 (Supabase).
- **Iedereen met het wachtwoord** kan AI-tegoed gebruiken, tot aan het maandbudget. Deel het niet.
- Start de server niet? Kijk in Railway bij **Deployments → Logs**. De meest voorkomende oorzaak is een ontbrekend of te kort `APP_PASSWORD`.

## Inbox voor je geplande taken

Je dagelijkse taken (Metapic-alert, HEMA viral, low kcal top 5, voorraadcheck, samenwerkingsreacties) kunnen hun tips naast de mail ook in ContentFlow afleveren. Ze komen dan in de kolom **Binnen** op het productiebord en als melding op **Vandaag**.

1. Voeg in Railway onder **Variables** toe: `INBOX_TOKEN` = de sleutel die je van Claude kreeg (minimaal 24 tekens).
2. Railway start de app opnieuw. Daarna nemen de taken hun tips mee.

Deze sleutel kan alleen tips **afleveren**. Je planning lezen of iets anders doen kan er niet mee; daarvoor blijft je wachtwoord nodig. Wil je de sleutel ooit vervangen, pas hem dan in Railway én in de taken aan.
