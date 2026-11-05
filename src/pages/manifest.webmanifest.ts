import type { APIRoute } from "astro";

// Web app manifest, generated so every path respects the site's base path.
export const GET: APIRoute = () => {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "") + "/";

  const manifest = {
    name: "Saunatime",
    short_name: "Saunatime",
    description:
      "Find the cheapest time to heat your sauna. Average cost of a 1 to 6 hour session from Finnish spot electricity prices.",
    id: base,
    start_url: base,
    scope: base,
    display: "standalone",
    orientation: "portrait",
    background_color: "#141413",
    theme_color: "#141413",
    lang: "en",
    categories: ["lifestyle", "utilities"],
    icons: [
      { src: `${base}icons/icon-192.png`, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: `${base}icons/icon-512.png`, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: `${base}icons/icon-maskable-512.png`, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    screenshots: [
      {
        src: `${base}screenshots/mobile.png`,
        sizes: "759x1644",
        type: "image/png",
        form_factor: "narrow",
        label: "Cheapest sauna hours with a session length slider",
      },
      {
        src: `${base}screenshots/wide.png`,
        sizes: "800x450",
        type: "image/png",
        form_factor: "wide",
        label: "Average sauna cost for 1 to 4 hours",
      },
    ],
  };

  return new Response(JSON.stringify(manifest, null, 2), {
    headers: { "Content-Type": "application/manifest+json" },
  });
};
