/**
 * Service to fetch real historical EV charging transactions from CitrineOS CSMS.
 * Queries PostgreSQL 'Transactions' and 'Authorizations' tables via Hasura GraphQL.
 */

import { HASURA_ENDPOINT } from '@/config/apiEndpoints';
import { fetchActiveTariff } from '@/services/tariffService';

export interface ChargingReceipt {
  id: string;
  transactionId: string;
  chargerId: string;
  bayName: string;
  startTime: string;
  endTime: string;
  durationMins: number;
  energyKwh: number;
  tariffRate: number;
  totalCost: number;
  status: 'Completed' | 'Charging' | 'Interrupted';
  stoppedReason: string;
  residentId: string;
}

export async function fetchUserChargingHistory(
  idToken = 'FLAT_A402_NITISH',
  signal?: AbortSignal,
): Promise<ChargingReceipt[]> {
  const query = `
    query GetResidentTransactions($idToken: citext!) {
      Transactions(
        where: { Authorization: { idToken: { _eq: $idToken } } }
        order_by: { id: desc }
      ) {
        id
        transactionId
        isActive
        chargingState
        timeSpentCharging
        totalKwh
        totalCost
        startTime
        endTime
        stoppedReason
        Authorization {
          idToken
        }
        ChargingStation {
          ocppConnectionName
          chargePointVendor
        }
      }
    }
  `;

  try {
    const tariff = await fetchActiveTariff(signal);
    const res = await fetch(HASURA_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        variables: { idToken },
      }),
      signal,
    });

    if (!res.ok) return [];
    const json = await res.json();
    const rows = json.data?.Transactions;
    if (!Array.isArray(rows)) return [];

    return rows.map((row: any): ChargingReceipt => {
      const kwh = Number(row.totalKwh || 0);
      const calculatedCost =
        row.totalCost && Number(row.totalCost) > 0
          ? Number(row.totalCost)
          : Number((kwh * tariff.pricePerKwh).toFixed(2));

      const durationSec = Number(row.timeSpentCharging || 0);
      const durationMins = Math.max(1, Math.round(durationSec / 60));

      const stationName = row.ChargingStation?.ocppConnectionName || 'cp001';
      const bayName = stationName === 'cp001' ? 'Bay 01' : stationName.toUpperCase();

      return {
        id: String(row.id),
        transactionId: row.transactionId || `TXN-${row.id}`,
        chargerId: stationName,
        bayName,
        startTime: row.startTime || new Date().toISOString(),
        endTime: row.endTime || new Date().toISOString(),
        durationMins,
        energyKwh: Number(kwh.toFixed(3)),
        tariffRate: tariff.pricePerKwh,
        totalCost: calculatedCost,
        status: row.isActive ? 'Charging' : 'Completed',
        stoppedReason: row.stoppedReason || 'Remote',
        residentId: row.Authorization?.idToken || idToken,
      };
    });
  } catch (err) {
    console.warn('Failed to fetch user transaction history from Hasura:', err);
    return [];
  }
}
