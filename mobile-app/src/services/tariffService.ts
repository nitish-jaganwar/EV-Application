/**
 * Service to fetch and manage live Society EV Charging Tariffs from CitrineOS CSMS.
 * Synchronized with PostgreSQL 'Tariffs' table via Hasura GraphQL.
 */

import { HASURA_ENDPOINT } from '@/config/apiEndpoints';

export interface TariffInfo {
  id: number;
  currency: string;
  pricePerKwh: number;
  pricePerMin: number;
  pricePerSession: number;
}

export const DEFAULT_TARIFF: TariffInfo = {
  id: 1,
  currency: 'INR',
  pricePerKwh: 8.6,
  pricePerMin: 0,
  pricePerSession: 0,
};

/**
 * Fetch the latest active tariff set by the society committee in CitrineOS.
 */
export async function fetchActiveTariff(signal?: AbortSignal): Promise<TariffInfo> {
  const query = `
    query GetActiveTariff {
      Tariffs(limit: 1, order_by: { id: desc }) {
        id
        currency
        pricePerKwh
        pricePerMin
        pricePerSession
      }
    }
  `;

  try {
    const res = await fetch(HASURA_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
      signal,
    });

    if (!res.ok) return DEFAULT_TARIFF;
    const json = await res.json();
    const tariff = json.data?.Tariffs?.[0];
    if (tariff && typeof tariff.pricePerKwh === 'number') {
      return {
        id: tariff.id,
        currency: tariff.currency || 'INR',
        pricePerKwh: tariff.pricePerKwh,
        pricePerMin: tariff.pricePerMin || 0,
        pricePerSession: tariff.pricePerSession || 0,
      };
    }
  } catch (err) {
    console.warn('Failed to fetch live tariff from Citrine, using default ₹8.60/kWh:', err);
  }
  return DEFAULT_TARIFF;
}
