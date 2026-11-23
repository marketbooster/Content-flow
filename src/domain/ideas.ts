// Redactioneel samengestelde startideeën per moment. Dit zijn handgeschreven templates
// (geen AI-output). De AI Content Studio kan ze later personaliseren of variaties maken.
//
// Recepten met een calorie-doel dragen `needsNutritionCalc`: de UI toont het doel als doel,
// niet als feit, totdat voedingswaarden op basis van echte ingrediënten zijn berekend.
import { addDays } from "./dates";
import type {
  ContentItem, CreatorProfile, EventOccurrence, IdeaFeedback, IdeaTemplate, ISODate,
} from "./types";

type T = Omit<IdeaTemplate, "id" | "eventId">;
const group = (eventId: string, items: (T & { slug: string })[]): IdeaTemplate[] =>
  items.map(({ slug, ...rest }) => ({ ...rest, id: `${eventId}.${slug}`, eventId }));

export const IDEA_TEMPLATES: IdeaTemplate[] = [
  ...group("sinterklaas", [
    {
      slug: "speculaas-cinnamon-rolls", pillar: "recepten", format: "reel",
      title: "Mini speculaas cinnamon rolls",
      hook: "Cinnamon rolls, maar dan Sinterklaas-proof — en lichter dan je denkt.",
      description: "Feestelijk bakrecept met romige frosting en eenvoudige ingrediënten. Toon het deeg-rollen in close-up.",
      publishDaysBefore: 10, productionMinutes: 120, tags: ["bakken", "speculaas"], needsNutritionCalc: true,
    },
    {
      slug: "snacks-onder-200", pillar: "recepten", format: "carrousel",
      title: "3 Sinterklaassnacks onder 200 kcal",
      hook: "Strooien zonder dat je hele weekbudget verdwijnt.",
      description: "Drie portie-ideeën (o.a. kruidnoten light). Doel: < 200 kcal per portie — wordt per recept berekend vóór publicatie.",
      publishDaysBefore: 14, productionMinutes: 150, tags: ["kruidnoten", "portiegrootte"], needsNutritionCalc: true,
    },
    {
      slug: "lowcal-kruidnoten", pillar: "recepten", format: "tiktok",
      title: "Low-cal kruidnoten in 15 minuten",
      hook: "Zelf kruidnoten maken met maar 5 ingrediënten.",
      description: "Snelle bak-TikTok met voice-over. Laat textuur zien bij het breken.",
      publishDaysBefore: 18, productionMinutes: 60, tags: ["kruidnoten"], needsNutritionCalc: true,
    },
    {
      slug: "speculaas-tiramisu", pillar: "recepten", format: "reel",
      title: "Eiwitrijke speculaas-tiramisu",
      hook: "Tiramisu als toetje op pakjesavond — maar dan met kwark.",
      description: "Laagjes-shot van bovenaf, eindigen met de eerste lepel.",
      publishDaysBefore: 7, productionMinutes: 90, tags: ["dessert", "eiwitrijk"], needsNutritionCalc: true,
    },
    {
      slug: "moeder-verwachting-realiteit", pillar: "moederschap", format: "reel",
      title: "Sinterklaas als moeder: verwachting vs. realiteit",
      hook: "Pinterest-pakjesavond vs. hoe het écht ging.",
      description: "Grappige split-screen met herkenbare momenten (cadeaus verstoppen, rijmpjes om 23:00).",
      publishDaysBefore: 3, productionMinutes: 60, tags: ["herkenbaar"],
    },
    {
      slug: "surprise-rijm-humor", pillar: "humor", format: "tiktok",
      title: "Mijn gedicht schrijven om 23:47",
      hook: "Iedereen die het gedicht ook altijd te laat schrijft 🙋‍♀️",
      description: "Herkenbare humor-sketch, eindigt met een (zelfspottend) rijm over afvallen.",
      publishDaysBefore: 2, productionMinutes: 30, tags: ["sketch"],
    },
    {
      slug: "cadeautips-sport", pillar: "samenwerkingen", format: "carrousel",
      title: "Cadeautips voor sportieve mama's (tot €25)",
      hook: "Cadeautjes die ik zélf zou willen krijgen.",
      description: "Affiliate- of samenwerkingskans. Altijd duidelijk als reclame/affiliate labelen.",
      publishDaysBefore: 21, productionMinutes: 90, tags: ["cadeautips", "affiliate"], commercial: true,
    },
    {
      slug: "story-pakjesavond", pillar: "moederschap", format: "story",
      title: "Live pakjesavond-stories",
      hook: "Poll: wat zit er in het grootste pakje?",
      description: "Snelle stories op de avond zelf met interactie (poll, quiz).",
      publishDaysBefore: 0, productionMinutes: 15, tags: ["interactie"],
    },
  ]),
  ...group("kerst", [
    {
      slug: "lowcal-kerstdessert", pillar: "recepten", format: "reel",
      title: "Low-cal kerstdessert dat er chique uitziet",
      hook: "Dit dessert ziet eruit als restaurantwerk.",
      description: "Glaasjes-dessert met kwark/skyr en rood fruit; mooi in laagjes gefilmd.",
      publishDaysBefore: 10, productionMinutes: 120, tags: ["dessert"], needsNutritionCalc: true,
    },
    {
      slug: "eiwitrijk-kerstontbijt", pillar: "recepten", format: "carrousel",
      title: "Eiwitrijk kerstontbijt voor het hele gezin",
      hook: "Feestelijk ontbijt dat je tot de lunch vol houdt.",
      description: "3 varianten in een carrousel, met boodschappenlijst op de laatste slide.",
      publishDaysBefore: 12, productionMinutes: 120, tags: ["ontbijt", "eiwitrijk"], needsNutritionCalc: true,
    },
    {
      slug: "zelfbeeld-feestdagen", pillar: "ontwikkeling", format: "reel",
      title: "Zelfbeeld tijdens de feestdagen",
      hook: "Je mag genieten in december. Echt.",
      description: "Persoonlijk talking-head-verhaal over schuldgevoel en balans; geen compensatie-advies.",
      publishDaysBefore: 8, productionMinutes: 45, tags: ["mindset", "persoonlijk"],
    },
    {
      slug: "kerstoutfit-postpartum", pillar: "afvallen", format: "reel",
      title: "Kerstoutfits voor een lijf in verandering",
      hook: "3 outfits waar ik me goed in voel — op elk gewicht.",
      description: "Try-on met eerlijke commentaar; kans voor kledingsamenwerking.",
      publishDaysBefore: 14, productionMinutes: 90, tags: ["outfits"], commercial: true,
    },
    {
      slug: "kerst-chaos", pillar: "humor", format: "tiktok",
      title: "Kerstdiner met peuters: een documentaire",
      hook: "Ik had een plan. Mijn kinderen niet.",
      description: "Mockumentary-stijl met voice-over.",
      publishDaysBefore: 1, productionMinutes: 45, tags: ["sketch", "gezin"],
    },
    {
      slug: "budget-kerstdiner", pillar: "recepten", format: "carrousel",
      title: "Budgetvriendelijk kerstdiner (4 personen)",
      hook: "Een compleet kerstdiner zonder dat je bankrekening huilt.",
      description: "Menu + boodschappenlijst. Prijzen alleen met actuele bron of weglaten.",
      publishDaysBefore: 10, productionMinutes: 150, tags: ["budget", "menu"], needsNutritionCalc: true,
    },
    {
      slug: "kerst-workout-thuis", pillar: "fitness", format: "reel",
      title: "15-minuten kerstvakantie-workout thuis",
      hook: "Geen sportschool open? Woonkamer it is.",
      description: "Workout zonder materiaal, ondertiteld, met timer in beeld.",
      publishDaysBefore: 4, productionMinutes: 60, tags: ["thuisworkout"],
    },
  ]),
  ...group("oud-en-nieuw", [
    {
      slug: "oliebollen-airfryer", pillar: "recepten", format: "reel",
      title: "Oliebollen uit de airfryer: de eerlijke test",
      hook: "Kan een oliebol zonder frituurpan? Ik test het.",
      description: "Eerlijke vergelijking incl. mislukte poging; voedingswaarde per stuk berekenen.",
      publishDaysBefore: 3, productionMinutes: 90, tags: ["oliebollen", "test"], needsNutritionCalc: true,
    },
    {
      slug: "jaarterugblik", pillar: "ontwikkeling", format: "carrousel",
      title: "Mijn jaar in 10 foto's (zonder filter)",
      hook: "Dit jaar was niet perfect, wel van mij.",
      description: "Persoonlijke terugblik, kan mijlpalen in afvalreis bevatten (alleen als je dat wilt delen).",
      publishDaysBefore: 1, productionMinutes: 60, tags: ["terugblik", "persoonlijk"],
    },
    {
      slug: "mocktails", pillar: "recepten", format: "tiktok",
      title: "2 mocktails voor middernacht",
      hook: "Proosten zonder alcohol — en ze zijn lekker.",
      description: "Snelle shake-shots met bubbels.",
      publishDaysBefore: 2, productionMinutes: 45, tags: ["mocktail"], needsNutritionCalc: true,
    },
  ]),
  ...group("januari-routines", [
    {
      slug: "realistische-doelen", pillar: "afvallen", format: "carrousel",
      title: "Realistische doelen in plaats van goede voornemens",
      hook: "Ik stopte met voornemens. Dit werkte wél.",
      description: "Klein-beginnen-framework uit eigen ervaring; geen crash-diëten promoten.",
      publishDaysBefore: 0, productionMinutes: 60, tags: ["doelen"],
    },
    {
      slug: "mealprep-zondag", pillar: "recepten", format: "reel",
      title: "Mealprep-zondag: 5 lunches in 1 uur",
      hook: "Eén uur werk = een hele week geen lunchstress.",
      description: "Time-lapse met overzicht per bakje; voedingswaarden per bakje berekenen.",
      publishDaysBefore: -5, productionMinutes: 120, tags: ["mealprep"], needsNutritionCalc: true,
    },
    {
      slug: "beginnen-met-bewegen", pillar: "fitness", format: "reel",
      title: "Beginnen met bewegen als je nul conditie hebt",
      hook: "Ik kon geen 5 minuten rennen. Dit was mijn start.",
      description: "Eerlijk persoonlijk verhaal + 3 eerste stappen.",
      publishDaysBefore: -3, productionMinutes: 60, tags: ["beginner"],
    },
    {
      slug: "pcos-januari", pillar: "pcos", format: "carrousel",
      title: "Afvallen met PCOS: wat ik anders doe",
      hook: "Waarom 'gewoon minder eten' bij mij niet werkte.",
      description: "Ervaring delen, geen medisch advies; verwijs naar huisarts/diëtist.",
      publishDaysBefore: -10, productionMinutes: 75, tags: ["pcos", "persoonlijk"],
    },
  ]),
  ...group("valentijn", [
    {
      slug: "lava-cake-light", pillar: "recepten", format: "reel",
      title: "Chocolade lava cake voor twee (light)",
      hook: "Date night dessert in 12 minuten.",
      description: "Close-up van het 'lava-moment'.",
      publishDaysBefore: 4, productionMinutes: 90, tags: ["dessert", "chocolade"], needsNutritionCalc: true,
    },
    {
      slug: "romantiek-met-kinderen", pillar: "humor", format: "tiktok",
      title: "Valentijn met kleine kinderen",
      hook: "Romantisch diner: gestart 19:00, onderbroken 19:02.",
      description: "Herkenbare sketch voor ouders.",
      publishDaysBefore: 1, productionMinutes: 30, tags: ["sketch"],
    },
  ]),
  ...group("pasen", [
    {
      slug: "paasbrunch", pillar: "recepten", format: "carrousel",
      title: "Eiwitrijke paasbrunch (4 recepten)",
      hook: "Een brunch die er feestelijk uitziet én je vol houdt.",
      description: "Recepten + planning welk gerecht wanneer klaarmaken.",
      publishDaysBefore: 10, productionMinutes: 150, tags: ["brunch"], needsNutritionCalc: true,
    },
    {
      slug: "eieren-zoeken", pillar: "moederschap", format: "reel",
      title: "Eieren zoeken: verwachting vs. realiteit",
      hook: "Het duurde 3 uur om ze te verstoppen en 4 minuten om ze te vinden.",
      description: "Grappige reel met gezinsbeelden (alleen wat je wilt delen van je kinderen).",
      publishDaysBefore: 0, productionMinutes: 45, tags: ["gezin"],
    },
  ]),
  ...group("koningsdag", [
    {
      slug: "oranje-snacks", pillar: "recepten", format: "reel",
      title: "Oranje snackplank onder de 500 kcal",
      hook: "Feestplank die je kunt delen zonder spijt.",
      description: "Doel < 500 kcal voor de hele plank — berekenen per ingrediënt.",
      publishDaysBefore: 3, productionMinutes: 60, tags: ["snacks"], needsNutritionCalc: true,
    },
    {
      slug: "vrijmarkt-humor", pillar: "humor", format: "tiktok",
      title: "Types op de vrijmarkt",
      hook: "Welke ben jij?",
      description: "Typetjes-sketch.",
      publishDaysBefore: 1, productionMinutes: 45, tags: ["sketch"],
    },
  ]),
  ...group("moederdag", [
    {
      slug: "ontbijt-op-bed", pillar: "recepten", format: "reel",
      title: "Ontbijt op bed dat kinderen zelf kunnen maken",
      hook: "Laat de kinderen het werk doen dit jaar.",
      description: "Simpel, eiwitrijk; kinderen in beeld alleen als je dat wilt.",
      publishDaysBefore: 5, productionMinutes: 60, tags: ["ontbijt", "kinderen"], needsNutritionCalc: true,
    },
    {
      slug: "moederschap-eerlijk", pillar: "moederschap", format: "reel",
      title: "Wat niemand je vertelt over moeder worden",
      hook: "Moederdag is mooi. Moederschap is soms ook gewoon zwaar.",
      description: "Eerlijk persoonlijk verhaal.",
      publishDaysBefore: 1, productionMinutes: 45, tags: ["persoonlijk"],
    },
    {
      slug: "moederdag-cadeaugids", pillar: "samenwerkingen", format: "carrousel",
      title: "Moederdag-cadeaugids (selfcare & sport)",
      hook: "Cadeaus die moeders écht willen.",
      description: "Samenwerkings-/affiliatekans; check exclusiviteit met lopende deals.",
      publishDaysBefore: 14, productionMinutes: 90, tags: ["cadeautips"], commercial: true,
    },
  ]),
  ...group("vaderdag", [
    {
      slug: "eiwit-snack-papa", pillar: "recepten", format: "reel",
      title: "Eiwitrijke snack voor papa (BBQ-proof)",
      hook: "Hij denkt dat het vette snacks zijn. Niet dus.",
      description: "BBQ-bites met kip of vis.",
      publishDaysBefore: 4, productionMinutes: 60, tags: ["bbq"], needsNutritionCalc: true,
    },
    {
      slug: "papa-humor", pillar: "humor", format: "tiktok",
      title: "Papa vs. mama: de bedtijdroutine",
      hook: "Zelfde kinderen, totaal andere aanpak.",
      description: "Herkenbare split-screen.",
      publishDaysBefore: 1, productionMinutes: 30, tags: ["sketch"],
    },
  ]),
  ...group("zomer", [
    {
      slug: "ijsjes-onder-100", pillar: "recepten", format: "reel",
      title: "Zelfgemaakte ijsjes onder 100 kcal",
      hook: "IJs voor het hele gezin, zonder suikerbom.",
      description: "Doel < 100 kcal per ijsje; berekenen per vorm/portie.",
      publishDaysBefore: -14, productionMinutes: 60, tags: ["ijs"], needsNutritionCalc: true,
    },
    {
      slug: "body-image-zomer", pillar: "ontwikkeling", format: "reel",
      title: "Geen 'summer body' nodig",
      hook: "Je hebt al een zomerlichaam. Dit is mijn bikini-verhaal.",
      description: "Persoonlijk, body-neutral.",
      publishDaysBefore: -10, productionMinutes: 45, tags: ["bodyimage"],
    },
    {
      slug: "bbq-light", pillar: "recepten", format: "carrousel",
      title: "BBQ light: 5 swaps die je niet proeft",
      hook: "Barbecueën zonder dat je het de rest van de week voelt.",
      description: "Swap-carrousel; voedingswaarden per swap berekenen.",
      publishDaysBefore: -20, productionMinutes: 90, tags: ["bbq", "swaps"], needsNutritionCalc: true,
    },
  ]),
  ...group("pcos-awareness-month", [
    {
      slug: "mijn-diagnose", pillar: "pcos", format: "reel",
      title: "Hoe ik ontdekte dat ik PCOS heb",
      hook: "Jarenlang dacht ik dat het aan mij lag.",
      description: "Persoonlijk diagnoseverhaal; afsluiten met: 'herken je dit? Ga naar je huisarts'.",
      publishDaysBefore: -1, productionMinutes: 60, tags: ["persoonlijk", "diagnose"],
    },
    {
      slug: "pcos-mythes", pillar: "pcos", format: "carrousel",
      title: "5 mythes over PCOS",
      hook: "Nee, je hoeft niet 'gewoon af te vallen'.",
      description: "Elke mythe met betrouwbare bron (bv. Thuisarts.nl, NVOG) op de slide vermelden.",
      publishDaysBefore: -8, productionMinutes: 90, tags: ["educatie"],
    },
    {
      slug: "pcos-recepten", pillar: "recepten", format: "reel",
      title: "Mijn PCOS-vriendelijke weekmenu",
      hook: "Wat ik eet op een normale dag met PCOS.",
      description: "Geen medische claims; 'dit werkt voor mij'-framing.",
      publishDaysBefore: -15, productionMinutes: 120, tags: ["pcos", "weekmenu"], needsNutritionCalc: true,
    },
    {
      slug: "pcos-qa", pillar: "pcos", format: "live",
      title: "PCOS Q&A live",
      hook: "Stel al je vragen — ik deel mijn ervaring.",
      description: "Vragen vooraf verzamelen via story-vragenbox.",
      publishDaysBefore: -22, productionMinutes: 60, tags: ["live", "interactie"],
    },
  ]),
  ...group("herfst", [
    {
      slug: "pompoensoep", pillar: "recepten", format: "reel",
      title: "Romige pompoensoep zonder room",
      hook: "Zo romig dat niemand gelooft dat er geen room in zit.",
      description: "Batch-cooking-hoek: 4 porties voor de vriezer.",
      publishDaysBefore: -10, productionMinutes: 60, tags: ["soep", "mealprep"], needsNutritionCalc: true,
    },
  ]),
  ...group("halloween", [
    {
      slug: "spooky-snacks", pillar: "recepten", format: "reel",
      title: "Spooky snacks voor kinderen (zonder suikerberg)",
      hook: "Monsterlijk lekker, verrassend licht.",
      description: "3 snacks met fruit/yoghurt; kinderen kunnen helpen.",
      publishDaysBefore: 5, productionMinutes: 75, tags: ["kinderen", "snacks"], needsNutritionCalc: true,
    },
  ]),
  ...group("black-friday", [
    {
      slug: "wat-ik-echt-gebruik", pillar: "samenwerkingen", format: "carrousel",
      title: "Black Friday: alleen wat ik écht gebruik",
      hook: "Geen impulsaankopen. Dit gebruik ik al maanden.",
      description: "Eerlijke lijst met affiliate-links (gelabeld). Controleer kortingen bij de bron vóór publicatie.",
      publishDaysBefore: 3, productionMinutes: 60, tags: ["affiliate", "eerlijk"], commercial: true,
    },
  ]),
  ...group("mentale-gezondheid", [
    {
      slug: "rust-als-moeder", pillar: "ontwikkeling", format: "reel",
      title: "Hoe ik rust vind als drukke moeder",
      hook: "Selfcare is bij mij geen bubbelbad.",
      description: "3 kleine, realistische gewoontes.",
      publishDaysBefore: 0, productionMinutes: 45, tags: ["mindset"],
    },
  ]),
];

export const ideaKey = (templateId: string, eventKey: string) => `${templateId}@${eventKey}`;

export interface IdeaSuggestion {
  key: string;
  template: IdeaTemplate;
  occurrence: EventOccurrence;
  idealPublishDate: ISODate;
  score: number;
}

/**
 * Persoonlijke, ontdubbelde ideeën voor een moment:
 * - afgewezen of al bewaarde/ingeplande ideeën komen niet terug;
 * - geblokkeerde onderwerpen worden weggefilterd;
 * - gesorteerd op het gewicht van de contentpijler bij deze creator.
 */
export function ideasFor(
  occ: EventOccurrence,
  creator: CreatorProfile,
  feedback: IdeaFeedback[],
  content: ContentItem[],
  templates: IdeaTemplate[] = IDEA_TEMPLATES,
): IdeaSuggestion[] {
  const decided = new Set(feedback.map((f) => f.ideaKey));
  const planned = new Set(
    content.filter((c) => c.ideaTemplateId && c.eventKey).map((c) => ideaKey(c.ideaTemplateId!, c.eventKey!)),
  );
  const pillarWeight = new Map(creator.pillars.map((p) => [p.id, p.weight]));
  const blocked = creator.blockedTopics.map((t) => t.toLowerCase()).filter(Boolean);

  return templates
    .filter((t) => t.eventId === occ.eventId)
    .filter((t) => (pillarWeight.get(t.pillar) ?? 0) > 0)
    .filter((t) => {
      const hay = `${t.title} ${t.description} ${t.tags.join(" ")}`.toLowerCase();
      return !blocked.some((b) => hay.includes(b));
    })
    .map((t) => {
      const key = ideaKey(t.id, occ.key);
      return {
        key,
        template: t,
        occurrence: occ,
        idealPublishDate: addDays(occ.start, -t.publishDaysBefore),
        score: Math.round((pillarWeight.get(t.pillar) ?? 0) * 100),
      };
    })
    .filter((s) => !decided.has(s.key) && !planned.has(s.key))
    .sort((a, b) => b.score - a.score || a.template.productionMinutes - b.template.productionMinutes);
}

export function ideaCountFor(eventId: string): number {
  return IDEA_TEMPLATES.filter((t) => t.eventId === eventId).length;
}
