// Bestanden inlezen in de browser. Afbeeldingen worden verkleind, zodat ze passen in de
// opslag van de browser (± 5 MB in totaal) en snel laden op de set.

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export type BriefingFileKind = "pdf" | "image" | "text" | "unsupported";

export function kindOf(file: File): BriefingFileKind {
  const name = file.name.toLowerCase();
  if (file.type === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("text/") || /\.(txt|md|csv)$/.test(name)) return "text";
  return "unsupported";
}

export function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(new Error("Bestand kon niet gelezen worden."));
    r.readAsDataURL(file);
  });
}

export function readAsText(file: File): Promise<string> {
  return file.text();
}

/** Verkleint een afbeelding tot max. `maxDim` px en slaat op als JPEG (data-URL). */
export async function compressImage(file: File, maxDim = 1600, quality = 0.72): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("Afbeelding kon niet geopend worden."));
      i.src = url;
    });
    const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Afbeelding verkleinen lukt niet in deze browser.");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Data-URL → { mediaType, base64 } voor de AI-aanroep. */
export function splitDataUrl(dataUrl: string): { mediaType: string; base64: string } {
  const [head, base64 = ""] = dataUrl.split(",");
  return { mediaType: head.replace(/^data:/, "").replace(/;base64$/, ""), base64 };
}
