import type { MetadataRoute } from "next";

/** PWA: permite "Adicionar ao ecrã inicial" e abrir como aplicação. Servido em /manifest.webmanifest (público). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LOOP OS",
    short_name: "LOOP OS",
    description: "Plataforma de gestão interna da LOOP Homes",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "pt-PT",
    background_color: "#F7F4EF",
    theme_color: "#F97B22",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
