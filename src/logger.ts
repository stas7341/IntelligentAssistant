export type LogLevel = "log" | "error" | "warn" | "info";
export type LogSource = "server" | "request" | "command" | "gemini" | "queryValidator" | "conversationManager" | "googlePlaces" | "googleEvents" | "validator";

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  source: LogSource;
}

const MAX_LOGS = 1000;
const logs: LogEntry[] = [];

function addLog(level: LogLevel, message: string, source: LogSource): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    source,
  };

  logs.push(entry);

  // Keep only the last MAX_LOGS entries
  if (logs.length > MAX_LOGS) {
    logs.shift();
  }
}

export const logger = {
  log: (message: string, source: LogSource = "server") => {
    console.log(`[${source}] ${message}`);
    addLog("log", message, source);
  },

  error: (message: string, source: LogSource = "server") => {
    console.error(`[${source}] ${message}`);
    addLog("error", message, source);
  },

  warn: (message: string, source: LogSource = "server") => {
    console.warn(`[${source}] ${message}`);
    addLog("warn", message, source);
  },

  info: (message: string, source: LogSource = "server") => {
    console.info(`[${source}] ${message}`);
    addLog("info", message, source);
  },
};

export function getLogs(): LogEntry[] {
  return [...logs];
}
