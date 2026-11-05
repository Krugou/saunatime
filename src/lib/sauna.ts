/**
 * Sauna heating cost from hourly spot prices.
 *
 * Assumes the heater draws its full rated power for the whole session.
 * Prices are c/kWh incl. VAT. Cost (€) = kW × hours × average price / 100.
 */

export interface PricePoint {
  /** Start of the hour, ms since epoch */
  start: number;
  /** c/kWh incl. VAT */
  price: number;
}

export const HOUR = 3_600_000;
export const DURATIONS = [1, 2, 3, 4];

const whenFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Helsinki",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
});

const eur = (n: number) => "€" + n.toFixed(2);

interface Window {
  start: number;
  /** Average price over the window, c/kWh */
  avg: number;
  /** Price of each hour in the window, c/kWh */
  prices: number[];
}

/** All back-to-back windows of `hours` hours that have not ended before `from`. */
function windowsFor(points: PricePoint[], hours: number, from: number): Window[] {
  const sorted = [...points].sort((a, b) => a.start - b.start);
  const out: Window[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const first = sorted[i];
    if (first.start + HOUR <= from) continue; // hour already over
    const prices: number[] = [];
    let complete = true;
    for (let k = 0; k < hours; k++) {
      const p = sorted[i + k];
      if (!p || p.start !== first.start + k * HOUR) {
        complete = false;
        break;
      }
      prices.push(p.price);
    }
    if (complete) {
      out.push({
        start: first.start,
        avg: prices.reduce((a, b) => a + b, 0) / hours,
        prices,
      });
    }
  }
  return out;
}

const timeOnlyFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Helsinki",
  hour: "2-digit",
  minute: "2-digit",
});

interface Analysis {
  hours: number;
  label: string;
  /** Average cost over every possible start, € */
  avgCost: number;
  /** Cheapest back-to-back window */
  cheapest: Window;
  /** Cost of the cheapest window, € */
  cheapCost: number;
  /** Average price of all upcoming hours, c/kWh ("cheap" = at or below this) */
  avgAll: number;
  /** data-* attributes for the Listen button */
  data: string;
}

function analyze(
  points: PricePoint[],
  kw: number,
  from: number,
  hours: number,
): Analysis | null {
  const windows = windowsFor(points, hours, from);
  if (windows.length === 0) return null;

  const upcoming = points.filter((p) => p.start + HOUR > from);
  const avgAll = upcoming.length
    ? upcoming.reduce((a, p) => a + p.price, 0) / upcoming.length
    : 0;

  const avgPrice = windows.reduce((a, w) => a + w.avg, 0) / windows.length;
  const cheapest = windows.reduce((a, w) => (w.avg < a.avg ? w : a));
  const cost = (avg: number) => (kw * hours * avg) / 100;

  // How many hours of the cheapest window stay cheap before a pricey one?
  let keep = 0;
  while (keep < hours && cheapest.prices[keep] <= avgAll) keep++;
  const keepCost =
    (kw * cheapest.prices.slice(0, keep).reduce((a, b) => a + b, 0)) / 100;
  const extra = keep < hours ? (kw * cheapest.prices[keep]) / 100 : 0;

  const data =
    `data-hours="${hours}" data-start="${cheapest.start}" ` +
    `data-cost="${cost(cheapest.avg).toFixed(4)}" data-keep="${keep}" ` +
    `data-keep-cost="${keepCost.toFixed(4)}" data-extra="${extra.toFixed(4)}"`;

  return {
    hours,
    label: hours === 1 ? "1 hour" : `${hours} hours`,
    avgCost: cost(avgPrice),
    cheapest,
    cheapCost: cost(cheapest.avg),
    avgAll,
    data,
  };
}

const listenButton = (a: Analysis) =>
  `<button type="button" class="say" aria-label="Read the cheapest ${a.label} sauna time aloud" ${a.data}>🔊 Listen</button>`;

/** List items (HTML): average cost, cheapest start and a Listen button per session length. */
export function renderSaunaRows(
  points: PricePoint[],
  kw: number,
  from: number,
): string {
  return DURATIONS.map((hours) => {
    const a = analyze(points, kw, from, hours);
    if (!a) {
      const label = hours === 1 ? "1 hour" : `${hours} hours`;
      return `<li><div class="label">${label}</div><div class="cost">–</div></li>`;
    }
    return (
      `<li><div class="label">${a.label}</div>` +
      `<div class="cost">${eur(a.avgCost)}</div>` +
      `<div class="best"><span>Cheapest: ${whenFmt.format(new Date(a.cheapest.start))} · ${eur(a.cheapCost)}</span>` +
      `${listenButton(a)}</div></li>`
    );
  }).join("");
}

/** Slider result (HTML): the best back-to-back hours for the chosen session length. */
export function renderBestHours(
  points: PricePoint[],
  kw: number,
  from: number,
  hours: number,
): string {
  const a = analyze(points, kw, from, hours);
  if (!a) return `<p class="muted">Not enough price data for ${hours} hours.</p>`;

  const w = a.cheapest;
  const range =
    `${whenFmt.format(new Date(w.start))} – ` +
    `${timeOnlyFmt.format(new Date(w.start + hours * HOUR))}`;
  const chips = w.prices
    .map((price, k) => {
      const t = timeOnlyFmt.format(new Date(w.start + k * HOUR));
      const cls = price <= a.avgAll ? "cheap" : "pricey";
      return `<span class="chip ${cls}"><b>${t}</b> ${price.toFixed(1)} c</span>`;
    })
    .join("");

  return (
    `<div class="range">${range}</div>` +
    `<div class="cost">${eur(a.cheapCost)}</div>` +
    `<div class="chips" aria-label="Price of each hour in c/kWh">${chips}</div>` +
    `<div class="best"><span>Best ${a.label} combined</span>${listenButton(a)}</div>`
  );
}

// ---------------------------------------------------------------------------
// Text-to-speech: varied, slightly silly messages
// ---------------------------------------------------------------------------

export interface SpeechInfo {
  /** Session length of the card, hours */
  hours: number;
  /** Start of the cheapest window, ms since epoch */
  start: number;
  /** Cost of the whole cheapest window, € */
  cost: number;
  /** Leading hours of that window that are at or below the average price */
  keep: number;
  /** Cost of those `keep` hours, € */
  keepCost: number;
  /** Cost of the first pricey hour after `keep`, € (0 when none) */
  extra: number;
}

export function speechInfoFrom(data: DOMStringMap): SpeechInfo {
  return {
    hours: Number(data.hours),
    start: Number(data.start),
    cost: Number(data.cost),
    keep: Number(data.keep),
    keepCost: Number(data.keepCost),
    extra: Number(data.extra),
  };
}

const spokenDayFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Helsinki",
  weekday: "long",
});
const spokenTimeFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Helsinki",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

const money = (n: number) => {
  if (n >= 1) return `${n.toFixed(2)} euros`;
  const cents = Math.round(n * 100);
  if (cents < 1) return "less than one cent";
  return `${cents} ${cents === 1 ? "cent" : "cents"}`;
};
const hoursWord = (n: number) => `${n} ${n === 1 ? "hour" : "hours"}`;

const OPENERS = [
  "Attention, steam enthusiasts!",
  "Breaking news from the land of a thousand saunas.",
  "Hot tip. Literally.",
  "Your wallet called. It wants you to listen.",
  "Greetings, sweaty human.",
  "Kilowatts are cheap and the vibes are hot.",
  "Ahem. The sauna oracle has spoken.",
  "Put down the birch twigs, I have numbers.",
];

const CLOSERS = [
  "Now go forth and sweat thriftily.",
  "May your steam be thick and your bill be thin.",
  "Towel up. Cash in.",
  "Birch twigs optional. Savings mandatory.",
  "Stay hot, stay frugal.",
  "Remember to hydrate. Water, not electricity.",
  "Go on, make the thermometer jealous.",
  "Sweat now, smile at the invoice later.",
];

const ALL_CHEAP = [
  (n: number) => `Good news! All ${n} of those hours are cheaper than average, so stay as long as you like. No guilt, only steam.`,
  (n: number) => `Every single hour of those ${n} is a bargain. Marinate like a happy sausage.`,
  (n: number) => `The grid is feeling generous for all ${n} hours. Take the long sauna and call it self care.`,
];

const ONE_CHEAP = [
  "That hour is cheaper than average. A quick steam with a tiny bill. Chef's kiss.",
  "One hour, low price. Short, sweet and slightly sweaty.",
  "A single hour at a bargain price. Efficiency is the true steam.",
];

const STOP_AT = [
  (k: number, keepCost: number, extra: number) =>
    `Stay for ${hoursWord(k)}, which costs about ${money(keepCost)}, then step out like a pro. The next hour jumps to ${money(extra)} on its own. Not worth the extra steam.`,
  (k: number, keepCost: number, extra: number) =>
    `It is cheap for ${hoursWord(k)}, about ${money(keepCost)} in total. After that the price gets spicy, ${money(extra)} for one more hour. Stop there and be smug about it.`,
  (k: number, keepCost: number, extra: number) =>
    `Here is the deal. ${hoursWord(k)} of bliss for ${money(keepCost)}, then the next hour costs ${money(extra)}. Quit while you are ahead and slightly red.`,
];

const KEEP_SHORT = [
  "Fair warning, even the first hour of that window is above the average price, so keep it short and sweet.",
  "That window starts pricey, so a quick sauna is the thrifty move.",
];

// Avoid repeating the same line twice in a row
const lastPick = new Map<string, number>();
function pick<T>(key: string, items: T[]): T {
  let i = Math.floor(Math.random() * items.length);
  if (items.length > 1 && i === lastPick.get(key)) i = (i + 1) % items.length;
  lastPick.set(key, i);
  return items[i];
}

/** Builds a fresh, randomly flavoured sentence for the Listen button. */
export function buildSpeech(info: SpeechInfo, now = Date.now()): string {
  const when = new Date(info.start);
  const away = Math.round((info.start - now) / HOUR);
  const timing =
    away <= 0 ? "That is right now." : `That is in ${hoursWord(away)}.`;

  const fact =
    `The cheapest time for a ${info.hours} hour sauna is ${spokenDayFmt.format(when)} at ` +
    `${spokenTimeFmt.format(when)}. ${timing} It costs about ${money(info.cost)}.`;

  let advice: string;
  if (info.keep >= info.hours && info.hours === 1) {
    advice = pick("onecheap", ONE_CHEAP);
  } else if (info.keep >= info.hours) {
    advice = pick("allcheap", ALL_CHEAP)(info.hours);
  } else if (info.keep >= 1) {
    advice = pick("stop", STOP_AT)(info.keep, info.keepCost, info.extra);
  } else {
    advice = pick("short", KEEP_SHORT);
  }

  return [pick("open", OPENERS), fact, advice, pick("close", CLOSERS)].join(" ");
}
