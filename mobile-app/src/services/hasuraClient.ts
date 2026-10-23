import { Platform } from 'react-native';
import { ChargerAvailability, ChargerItem } from '@/services/chargerInventory';
import { HASURA_ENDPOINT } from '@/config/apiEndpoints';

export { HASURA_ENDPOINT };

interface HasuraConnector {
  id: number;
  connectorId: number | null;
  status: string | null;
  maximumPowerWatts: number | null;
  powerType: string | null;
  type: string | null;
}

interface HasuraEvse {
  id: number;
  evseId: string | null;
  physicalReference: string | null;
  Connectors: HasuraConnector[];
}

interface HasuraStation {
  id: number;
  ocppConnectionName: string | null;
  chargePointModel: string | null;
  chargePointVendor: string | null;
  floorLevel: string | null;
  isOnline: boolean | null;
  Evses: HasuraEvse[];
}

interface HasuraResponse {
  data?: {
    ChargingStations: HasuraStation[];
  };
  errors?: Array<{ message: string }>;
}

const mapDbStatusToAvailability = (dbStatus: string | null): ChargerAvailability => {
  if (!dbStatus) return 'AVAILABLE';
  const s = dbStatus.toUpperCase();
  if (s === 'CHARGING' || s === 'OCCUPIED' || s === 'FINISHING') return 'OCCUPIED';
  if (s === 'PREPARING') return 'AVAILABLE'; // Plugged in and waiting for user start
  if (s === 'RESERVED') return 'RESERVED';
  if (s === 'UNAVAILABLE' || s === 'FAULTED') return 'OFFLINE';
  return 'AVAILABLE';
};

const mapConnectorType = (dbType: string | null): '15A Socket' | 'Type 2' | 'CCS2' => {
  if (!dbType) return 'Type 2';
  if (dbType.includes('Socket') || dbType.includes('16A')) return '15A Socket';
  if (dbType.includes('CCS') || dbType.includes('Combo')) return 'CCS2';
  return 'Type 2';
};

export async function fetchLiveApartmentChargersFromHasura(
  timeoutMs = 3500
): Promise<ChargerItem[] | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const query = `
    query GetApartmentChargers {
      ChargingStations(order_by: {id: asc}) {
        id
        ocppConnectionName
        chargePointModel
        chargePointVendor
        floorLevel
        isOnline
        Evses {
          id
          evseId
          physicalReference
          Connectors {
            id
            connectorId
            status
            maximumPowerWatts
            powerType
            type
          }
        }
      }
    }
  `;

  try {
    const res = await fetch(HASURA_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
      signal: controller.signal,
    });

    if (!res.ok) {
      console.warn(`Hasura returned HTTP ${res.status}`);
      return null;
    }

    const json: HasuraResponse = await res.json();
    if (!json.data || !json.data.ChargingStations) {
      return null;
    }

    const items: ChargerItem[] = [];

    json.data.ChargingStations.forEach((station) => {
      station.Evses.forEach((evse, evseIdx) => {
        // Skip station-level connector 0 entries
        if (!evse.evseId || !evse.physicalReference) {
          return;
        }

        const validConnectors = evse.Connectors.filter((c) => c.connectorId !== null);
        const conn = validConnectors[0] || evse.Connectors[0];
        if (!conn) return;

        const status = mapDbStatusToAvailability(conn.status);
        const powerKw = conn && conn.maximumPowerWatts ? Number((conn.maximumPowerWatts / 1000).toFixed(1)) : 11.0;
        const connectorType = mapConnectorType(conn?.type || null);
        const powerType = (conn?.powerType?.startsWith('DC') ? 'DC' : 'AC') as 'AC' | 'DC';
        
        // Derive clean Bay name
        const rawBay = evse.physicalReference || `Bay ${String(station.id).padStart(2, '0')}`;
        const cleanBay = rawBay.split(' ')[0] + ' ' + (rawBay.split(' ')[1] || '');
        const bayNumber = cleanBay.trim();

        // Unique ID for UI selection
        const id = `${station.ocppConnectionName || `cs${station.id}`}_e${evse.evseId || evseIdx + 1}`;

        // Rates according to society tariff guidelines
        const is2Wheeler = connectorType === '15A Socket' || powerKw <= 3.3;
        const walkInRatePerKwh = is2Wheeler ? 12 : 15;
        const reservationRatePerKwh = is2Wheeler ? 9 : 11;

        items.push({
          id,
          name: `tBits ${rawBay}`,
          bayNumber,
          status,
          powerKw,
          powerType,
          connectorType,
          walkInRatePerKwh,
          reservationRatePerKwh,
          currency: '₹',
          notes: `${station.floorLevel ? `${station.floorLevel} · ` : ''}${station.chargePointModel || 'Smart Charger'}`,
          currentOccupantPlate: undefined,
          estimatedAvailableTime: undefined,
        });
      });
    });

    // Sort in natural bay order (Bay 01 to Bay 15)
    items.sort((a, b) => a.bayNumber.localeCompare(b.bayNumber, undefined, { numeric: true }));
    return items.length > 0 ? items : null;
  } catch (err) {
    // Hasura unreachable or timed out; caller can fall back to local inventory
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Auto-provisions a resident's idToken in CitrineOS Authorizations table on 1st time registration.
 */
export async function provisionResidentTokenInHasura(profile: {
  fullName: string;
  block?: string;
  apartmentNumber?: string;
}): Promise<string | null> {
  const cleanBlock = (profile.block || 'Tower A').replace(/[^a-zA-Z0-9]/g, '');
  const cleanApt = (profile.apartmentNumber || '402').replace(/[^a-zA-Z0-9]/g, '');
  const cleanName = profile.fullName.trim().split(' ')[0].toUpperCase();
  const idToken = `FLAT_${cleanBlock}_${cleanApt}_${cleanName}`;
  const now = new Date().toISOString();

  const mutation = `
    mutation ProvisionResident($obj: Authorizations_insert_input!) {
      insert_Authorizations_one(object: $obj) {
        id
        idToken
        status
      }
    }
  `;

  try {
    const res = await fetch(HASURA_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: mutation,
        variables: {
          obj: {
            idToken,
            idTokenType: 'Central',
            status: 'Accepted',
            concurrentTransaction: false,
            createdAt: now,
            updatedAt: now,
          },
        },
      }),
    });
    const json = await res.json();
    if (json.data?.insert_Authorizations_one) {
      return idToken;
    }
    return null;
  } catch {
    return null;
  }
}

