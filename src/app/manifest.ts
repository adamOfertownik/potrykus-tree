import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Drzewo Potrykus",
    short_name: "Potrykus",
    description:
      "Prywatne drzewo genealogiczne rodziny Potrykus — przeglądaj krewnych, zgłaszaj poprawki i spotkania rodzinne.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0f1a12",
    theme_color: "#1f3d2a",
    orientation: "any",
    lang: "pl",
    categories: ["lifestyle", "social"],
    shortcuts: [
      {
        name: "Drzewo",
        short_name: "Drzewo",
        url: "/drzewo",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Spotkanie",
        short_name: "Spotkanie",
        url: "/spotkanie",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
    ],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
