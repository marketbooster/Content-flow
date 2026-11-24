import { ImageResponse } from "next/og";
import { serviceRepo } from "@/lib/db";
import { verifySlide } from "@/lib/slides";
import type { Slide } from "@/lib/types";

// Carrousel-slides in huisstijl (Poppins, #151A28, #EB1971), 1080×1350 (Instagram portret).
// Publiek bereikbaar met een geldige handtekening, zodat Instagram de afbeelding kan ophalen.

const NAVY = "#151A28";
const PINK = "#EB1971";

let fonts: Promise<{ name: string; data: ArrayBuffer; weight: 400 | 600 | 700; style: "normal" }[]> | null = null;

async function loadFont(weight: 400 | 600 | 700) {
  // Zonder browser-user-agent levert Google Fonts TTF, wat de renderer nodig heeft.
  const css = await (await fetch(`https://fonts.googleapis.com/css2?family=Poppins:wght@${weight}`)).text();
  const url = css.match(/src: url\((.+?)\)/)?.[1];
  if (!url) throw new Error("Poppins niet gevonden");
  return { name: "Poppins", data: await (await fetch(url)).arrayBuffer(), weight, style: "normal" as const };
}

function getFonts() {
  fonts ??= Promise.all([loadFont(400), loadFont(600), loadFont(700)]).catch((err) => {
    fonts = null;
    console.warn("Poppins laden mislukt, val terug op standaardfont", err);
    return [];
  });
  return fonts;
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string; index: string }> }) {
  const { id, index } = await ctx.params;
  const url = new URL(req.url);
  const i = Number(index);
  if (!Number.isInteger(i) || i < 0 || !verifySlide(id, i, url.searchParams.get("sig") ?? "")) {
    return new Response("Niet toegestaan", { status: 403 });
  }
  const item = await serviceRepo().getInboxItem(id);
  if (!item) return new Response("Niet gevonden", { status: 404 });

  const slides: Slide[] = item.payload.slides?.length
    ? item.payload.slides
    : [{ title: item.title, body: item.body.split("\n").find((l) => l.trim()) ?? "" }];
  const slide = slides[i];
  if (!slide) return new Response("Niet gevonden", { status: 404 });
  const first = i === 0;
  const last = i === slides.length - 1 && slides.length > 1;

  const image = new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 96,
          background: first || last ? NAVY : "#FFFFFF",
          color: first || last ? "#FFFFFF" : NAVY,
          fontFamily: "Poppins",
        }}
      >
        <div style={{ display: "flex", fontSize: 30, fontWeight: 600, color: PINK }}>{first ? "" : `${i + 1}/${slides.length}`}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
          <div style={{ display: "flex", width: 96, height: 10, background: PINK, borderRadius: 5 }} />
          <div style={{ display: "flex", fontSize: first ? 92 : 72, fontWeight: 700, lineHeight: 1.1, letterSpacing: -1 }}>{slide.title}</div>
          {slide.body && (
            <div style={{ display: "flex", fontSize: first ? 40 : 44, fontWeight: 400, lineHeight: 1.45, opacity: first || last ? 0.85 : 0.8 }}>
              {slide.body}
            </div>
          )}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 28, fontWeight: 600, opacity: 0.7 }}>
          <span>Marketbooster</span>
          {!last && slides.length > 1 && <span>{"swipe →"}</span>}
        </div>
      </div>
    ),
    { width: 1080, height: 1350, fonts: await getFonts() },
  );

  const headers = { "cache-control": "public, max-age=300" };
  if (url.searchParams.get("format") === "jpeg") {
    // Instagram accepteert alleen JPEG.
    const sharp = (await import("sharp")).default;
    const jpeg = await sharp(Buffer.from(await image.arrayBuffer())).jpeg({ quality: 92 }).toBuffer();
    return new Response(new Uint8Array(jpeg), { headers: { ...headers, "content-type": "image/jpeg" } });
  }
  return new Response(image.body, { headers: { ...headers, "content-type": "image/png" } });
}
