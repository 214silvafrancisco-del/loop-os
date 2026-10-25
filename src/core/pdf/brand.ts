import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";

/** Cores da identidade LOOP para PDFs (ver globals.css). */
export const PDF_COLORS = {
  ink: "#262626",
  orange: "#F97B22",
  muted: "#8A8580",
  line: "#E6E1DA",
  canvas: "#F7F4EF",
  warn: "#B45309",
} as const;

/** Logótipo para PDFs (PNG com fundo transparente), em data URL. `null` se não existir. */
export async function loadPdfLogo(): Promise<string | null> {
  try {
    const buf = await readFile(path.join(process.cwd(), "public", "brand", "logo.png"));
    return `data:image/png;base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}
