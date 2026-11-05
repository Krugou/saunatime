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
}

/** All back-to-back windows of `hours` hours that have not ended before `from`. */
function windowsFor(points: PricePoint[], hours: number, from: number): Window[] {
  const sorted = [...points].sort((a, b) => a.start - b.start);
  const out: Window[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const first = sorted[i];
    if (first.start + HOUR <= from) continue; // hour already over
    let sum = 0;
    let complete = true;
    for (let k = 0; k < hours; k++) {
      const p = sorted[i + k];
      if (!p || p.start !== first.start + k * HOUR) {
        complete = false;
        break;
      }
      sum += p.price;
    }
    if (complete) out.push({ start: first.start, avg: sum / hours });
  }
  return out;
}

/** List items (HTML): average cost and cheapest start for each session length. */
export function renderSaunaRows(
  points: PricePoint[],
  kw: number,
  from: number,
): string {
  return DURATIONS.map((hours) => {
    const label = hours === 1 ? "1 hour" : `${hours} hours`;
    const windows = windowsFor(points, hours, from);
    if (windows.length === 0) {
      return `<li><div class="label">${label}</div><div class="cost">–</div></li>`;
    }
    const avgPrice = windows.reduce((a, w) => a + w.avg, 0) / windows.length;
    const cheapest = windows.reduce((a, w) => (w.avg < a.avg ? w : a));
    const cost = (avg: number) => (kw * hours * avg) / 100;
    return (
      `<li><div class="label">${label}</div>` +
      `<div class="cost">${eur(cost(avgPrice))}</div>` +
      `<div class="best">Cheapest: ${whenFmt.format(new Date(cheapest.start))} · ${eur(cost(cheapest.avg))}</div></li>`
    );
  }).join("");
}
