/**
 * Combines Finnish spot electricity prices (pörssisähkö) from two public sources:
 *
 * - porssisahko.net: hourly prices, c/kWh, including VAT
 * - Elering (Nord Pool, Finland area): 15-minute prices, €/MWh, excluding VAT
 *
 * Both are aligned to hourly slots (Elering is averaged per hour) so they can be
 * compared directly. Fetching happens at build time, so the page is static.
 */

/** Finnish VAT rate (25.5% since 1 Sep 2024). */
export const VAT = 1.255;

const PORSSISAHKO_URL = "https://api.porssisahko.net/v1/latest-prices.json";
const ELERING_URL = "https://dashboard.elering.ee/api/nps/price";

export interface HourPoint {
  start: Date;
  /** porssisahko.net, c/kWh incl. VAT */
  porssisahko: number | null;
  /** Elering, €/MWh excl. VAT (hourly average of 15-min prices) */
  elering: number | null;
  /** Elering converted to c/kWh incl. VAT, for comparison with porssisahko */
  eleringCents: number | null;
}

export interface PriceData {
  points: HourPoint[];
  errors: string[];
  fetchedAt: Date;
}

interface PorssisahkoResponse {
  prices: { price: number; startDate: string }[];
}

interface EleringResponse {
  success: boolean;
  data: { fi: { timestamp: number; price: number }[] };
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

export async function loadPrices(): Promise<PriceData> {
  const errors: string[] = [];
  const byHour = new Map<number, HourPoint>();

  const slot = (ms: number): HourPoint => {
    let point = byHour.get(ms);
    if (!point) {
      point = {
        start: new Date(ms),
        porssisahko: null,
        elering: null,
        eleringCents: null,
      };
      byHour.set(ms, point);
    }
    return point;
  };

  try {
    const data = await getJson<PorssisahkoResponse>(PORSSISAHKO_URL);
    for (const p of data.prices) {
      slot(new Date(p.startDate).getTime()).porssisahko = p.price;
    }
  } catch (e) {
    errors.push(`porssisahko.net: ${(e as Error).message}`);
  }

  try {
    const data = await getJson<EleringResponse>(ELERING_URL);
    const buckets = new Map<number, number[]>();
    for (const q of data.data.fi) {
      const hour = Math.floor(q.timestamp / 3600) * 3600 * 1000;
      const list = buckets.get(hour) ?? [];
      list.push(q.price);
      buckets.set(hour, list);
    }
    for (const [hour, values] of buckets) {
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      const point = slot(hour);
      point.elering = avg;
      point.eleringCents = (avg * VAT) / 10; // €/MWh excl. VAT -> c/kWh incl. VAT
    }
  } catch (e) {
    errors.push(`Elering: ${(e as Error).message}`);
  }

  const points = [...byHour.values()].sort(
    (a, b) => a.start.getTime() - b.start.getTime(),
  );
  return { points, errors, fetchedAt: new Date() };
}
