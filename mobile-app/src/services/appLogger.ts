/**
 * In-App Diagnostic Event Logger
 * Records real-time API transactions, Citrine responses, and OCPP state changes.
 * Allows residents and engineers to inspect live communication logs inside the app.
 */

export interface LogEntry {
  id: string;
  timestamp: string;
  category: 'API' | 'OCPP' | 'TELEMETRY' | 'ERROR';
  title: string;
  details?: string;
  status: 'SUCCESS' | 'REJECTED' | 'PENDING' | 'INFO';
}

const MAX_LOGS = 40;
const logStore: LogEntry[] = [
  {
    id: `init-${Date.now()}`,
    timestamp: new Date().toLocaleTimeString(),
    category: 'OCPP',
    title: 'OCPP 1.6 Protocol Active',
    details: 'Connected to CitrineOS CSMS on port 8081 (ws://host.docker.internal:8081/cp001)',
    status: 'SUCCESS',
  },
];

type LogListener = (logs: LogEntry[]) => void;
const listeners = new Set<LogListener>();

export function addAppLog(
  category: LogEntry['category'],
  title: string,
  details?: string,
  status: LogEntry['status'] = 'INFO'
) {
  const entry: LogEntry = {
    id: `${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toLocaleTimeString(),
    category,
    title,
    details,
    status,
  };

  logStore.unshift(entry);
  if (logStore.length > MAX_LOGS) {
    logStore.pop();
  }

  listeners.forEach((listener) => {
    try {
      listener([...logStore]);
    } catch {
      // Ignore listener error
    }
  });
}

export function getAppLogs(): LogEntry[] {
  return [...logStore];
}

export function subscribeAppLogs(listener: LogListener): () => void {
  listeners.add(listener);
  listener([...logStore]);
  return () => {
    listeners.delete(listener);
  };
}
