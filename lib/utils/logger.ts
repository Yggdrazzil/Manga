type Level = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: Level;
  message: string;
  ts: string;
  context?: Record<string, unknown>;
}

const MAX_BUFFER = 200;
const buffer: LogEntry[] = [];

function log(level: Level, message: string, context?: Record<string, unknown>): void {
  if (!__DEV__ && level === 'debug') return;

  const entry: LogEntry = { level, message, ts: new Date().toISOString(), context };
  buffer.push(entry);
  if (buffer.length > MAX_BUFFER) buffer.shift();

  const fmt = context ? `[${level.toUpperCase()}] ${message}` : `[${level.toUpperCase()}] ${message}`;
  if (level === 'error') console.error(fmt, context ?? '');
  else if (level === 'warn') console.warn(fmt, context ?? '');
  else if (__DEV__) console.log(fmt, context ?? '');
}

export const logger = {
  debug: (msg: string, ctx?: Record<string, unknown>) => log('debug', msg, ctx),
  info:  (msg: string, ctx?: Record<string, unknown>) => log('info',  msg, ctx),
  warn:  (msg: string, ctx?: Record<string, unknown>) => log('warn',  msg, ctx),
  error: (msg: string, ctx?: Record<string, unknown>) => log('error', msg, ctx),

  /** Returns a copy of the recent log buffer (newest last). */
  dump: (): Readonly<LogEntry>[] => [...buffer],
};
