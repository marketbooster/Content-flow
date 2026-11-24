// Startinhoud voor de demo-modus, zodat je de app meteen kunt doorklikken.
// In Supabase vul je het brein zelf via Profiel → Merkbrein.
import { randomUUID } from "node:crypto";
import type { Brain, ContentIdea, InboxItem } from "../types";
import { PILLARS } from "../types";

export const STARTER_BRAIN: Omit<Brain, "updated_at" | "learnings"> = {
  tone: "Direct, warm, Nederlands. Je/jij. Korte zinnen. Geen hype, geen jargon. Raket-metafoor spaarzaam.",
  icp: "MKB-ondernemers (5–50 medewerkers) in Overijssel en Gelderland die verdrinken in handwerk: offertes, administratie, klantmails.",
  pillars: [...PILLARS],
  prices: "Gratis AI-scan · Workshop · Implementatietraject op maat",
  forbidden_words: ["revolutionair", "game-changer", "disruptief", "synergie", "in de huidige snel veranderende wereld"],
  what_worked: "",
  contentbank: [
    "Offertes in 5 minuten met ChatGPT",
    "Waarom AI je personeel niet vervangt",
    "Inbox sorteren met één prompt",
    "Facturen automatisch inlezen met Zapier",
  ],
};

export function demoSeed(s: { brain: Brain; inbox: InboxItem[]; ideas: ContentIdea[] }) {
  s.brain = { ...s.brain, ...STARTER_BRAIN };
  const base = {
    agent: "creator" as const,
    recipient_key: null,
    value_hint: null,
    status: "pending" as const,
    visible_from: null,
    scheduled_at: null,
    send_after: null,
    snoozed_until: null,
    reject_reason: null,
    sent_at: null,
    result: null,
    calendar_id: null,
    lead_id: null,
    created_at: new Date().toISOString(),
  };
  s.inbox.push(
    {
      ...base,
      id: randomUUID(),
      type: "post",
      channel: "linkedin",
      recipient: "Je LinkedIn-feed",
      title: "Die offerte van vrijdagmiddag",
      reason: "Pijler tijd terugwinnen; vrij slot vandaag 08:30",
      value_hint: "Je best scorende onderwerp van vorige maand",
      priority: 3,
      body:
        "Vrijdag, 16:40. Nog drie offertes.\n\nIk sprak deze week een installateur uit Kampen. Elke offerte kostte hem 45 minuten. Knippen, plakken, prijzen nalopen.\n\nNu: één prompt, zijn eigen prijslijst erbij, en hij controleert alleen nog.\n\n12 minuten per offerte. Dat is 5 uur per week terug.\n\nAI neemt zijn werk niet over. Het geeft hem zijn vrijdagmiddag terug.\n\nHoeveel tijd gaat er bij jou in offertes zitten?",
      payload: { first_comment: "Wil je de prompt? Reageer OFFERTE, dan stuur ik hem je.", hashtags: ["MKB", "AI"] },
    },
    {
      ...base,
      id: randomUUID(),
      type: "carousel",
      channel: "instagram",
      recipient: "Je Instagram",
      title: "3 AI-mythes die MKB tegenhouden",
      reason: "Pijler AI-mythbusters; carrousels doen het op Instagram 2× beter",
      priority: 2,
      body: "3 dingen die je over AI hoort en die niet kloppen. Swipe →\n\n#mkb #ai #ondernemen",
      payload: {
        slides: [
          { title: "3 AI-mythes", body: "die MKB-ondernemers tegenhouden" },
          { title: "1. Het is te duur", body: "De meeste tools kosten minder dan je koffie per maand." },
          { title: "2. Het kost banen", body: "Het kost vooral saaie uren. Je mensen doen weer het werk waarvoor ze kwamen." },
          { title: "3. Je moet technisch zijn", body: "Als je een mail kunt typen, kun je een prompt typen." },
          { title: "Benieuwd wat het jou oplevert?", body: "Doe de gratis AI-scan · link in bio" },
        ],
      },
    },
  );
  const ideas: [string, string, ContentIdea["format"], ContentIdea["channel"], string][] = [
    ["Wat ik zag bij een bakker die 6 uur per week mailde", "praktijkcase met cijfers", "post", "linkedin", "praktijkcases"],
    ["Mijn ochtendroutine met 3 AI-tools", "achter de schermen, persoonlijk", "reel", "instagram", "achter de schermen"],
    ["ChatGPT verzint dingen. Zo voorkom je het.", "mythbuster met 3 tips", "carousel", "linkedin", "AI-mythbusters"],
    ["Installateurs: dit doe je met AI op maandag", "branche-toepassing", "carousel", "instagram", "branche-toepassingen"],
  ];
  for (const [hook, angle, format, channel, pillar] of ideas) {
    s.ideas.push({
      id: randomUUID(),
      created_at: new Date().toISOString(),
      hook,
      angle,
      format,
      channel,
      pillar,
      tags: pillar === "achter de schermen" ? ["persoonlijk"] : [],
      status: "new",
      reject_reason: null,
      run_id: null,
    });
  }
}
