/**
 * Centralized API & Endpoint Configuration for tBits Plug EV Charging App.
 * All URLs, ports, and environment configurations are maintained here.
 */

// Base URLs loaded from environment (.env / .env.local) with production defaults
export const CITRINE_BASE_URL = (
  process.env.EXPO_PUBLIC_CITRINE_URL || 'http://65.21.108.234:8080'
).replace(/\/$/, '');

export const HASURA_ENDPOINT = (
  process.env.EXPO_PUBLIC_HASURA_URL || 'http://65.21.108.234:8090/v1/graphql'
).replace(/\/$/, '');

export const DEFAULT_CHARGER_ID = process.env.EXPO_PUBLIC_CHARGER_ID || 'cp001';
export const DEFAULT_TENANT_ID = Number(process.env.EXPO_PUBLIC_TENANT_ID || '1');

// Polling interval for live telemetry
const configuredPollInterval = Number(process.env.EXPO_PUBLIC_CHARGER_POLL_INTERVAL_MS);
export const CHARGER_POLL_INTERVAL_MS =
  Number.isFinite(configuredPollInterval) && configuredPollInterval >= 2_000
    ? configuredPollInterval
    : 5_000;

export const USE_MOCK_CHARGER = process.env.EXPO_PUBLIC_USE_MOCK_CHARGER === 'true';

// Push Notification Dispatcher Service URL
export const PUSH_SERVICE_URL = (
  process.env.EXPO_PUBLIC_PUSH_SERVICE_URL || 'http://65.21.108.234:9200'
).replace(/\/$/, '');

// Legacy mock proxy server base URL (optional fallback)
export const LEGACY_PROXY_URL = (
  process.env.EXPO_PUBLIC_API_BASE_URL || ''
).replace(/\/$/, '');

/**
 * Single source of truth for all external API endpoints
 */
export const API_ENDPOINTS = {
  // Push Notification Dispatcher
  PUSH: {
    REGISTER_TOKEN: `${PUSH_SERVICE_URL}/api/register-token`,
    SEND_TEST: `${PUSH_SERVICE_URL}/api/send-test`,
  },

  // CitrineOS OCPP 1.6 EV Driver Endpoints
  OCPP_16: {
    REMOTE_START: (chargerId: string, tenantId = DEFAULT_TENANT_ID) =>
      `${CITRINE_BASE_URL}/ocpp/1.6/evdriver/remoteStartTransaction?identifier=${encodeURIComponent(chargerId)}&tenantId=${tenantId}`,

    REMOTE_STOP: (chargerId: string, tenantId = DEFAULT_TENANT_ID) =>
      `${CITRINE_BASE_URL}/ocpp/1.6/evdriver/remoteStopTransaction?identifier=${encodeURIComponent(chargerId)}&tenantId=${tenantId}`,

    UNLOCK_CONNECTOR: (chargerId: string, tenantId = DEFAULT_TENANT_ID) =>
      `${CITRINE_BASE_URL}/ocpp/1.6/evdriver/unlockConnector?identifier=${encodeURIComponent(chargerId)}&tenantId=${tenantId}`,
  },

  // CitrineOS OCPP 2.0.1 / 2.1 EV Driver Endpoints
  OCPP_201: {
    REQUEST_START: (chargerId: string, tenantId = DEFAULT_TENANT_ID) =>
      `${CITRINE_BASE_URL}/ocpp/2.1/evdriver/requestStartTransaction?identifier=${encodeURIComponent(chargerId)}&tenantId=${tenantId}`,

    REQUEST_STOP: (chargerId: string, tenantId = DEFAULT_TENANT_ID) =>
      `${CITRINE_BASE_URL}/ocpp/2.1/evdriver/requestStopTransaction?identifier=${encodeURIComponent(chargerId)}&tenantId=${tenantId}`,

    UNLOCK_CONNECTOR: (chargerId: string, tenantId = DEFAULT_TENANT_ID) =>
      `${CITRINE_BASE_URL}/ocpp/2.1/evdriver/unlockConnector?identifier=${encodeURIComponent(chargerId)}&tenantId=${tenantId}`,
  },

  // Hasura GraphQL Endpoint (Live Citrine DB queries & subscriptions)
  GRAPHQL: HASURA_ENDPOINT,
};
