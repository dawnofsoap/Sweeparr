import winston from 'winston';
import path from 'path';
import fs from 'fs';

const logLevel = process.env.LOG_LEVEL || 'info';
// Use /logs in production (Docker mount), ./logs for local development
const logPath = process.env.NODE_ENV === 'production' 
  ? (process.env.LOG_PATH || '/logs')
  : (process.env.LOG_PATH || './logs');

// In-memory log buffer for application logs (not HTTP requests)
const MAX_LOG_ENTRIES = 500;
const appLogBuffer: Array<{ timestamp: string; level: string; message: string; category?: string }> = [];

// Add an application log entry
function addAppLog(level: string, message: string, category?: string) {
  const entry = {
    timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
    level,
    message,
    category,
  };

  appLogBuffer.push(entry);
  
  // Keep buffer size limited
  while (appLogBuffer.length > MAX_LOG_ENTRIES) {
    appLogBuffer.shift();
  }
}

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ level, message, timestamp, stack }) => {
    return `${timestamp} [${level.toUpperCase()}]: ${stack || message}`;
  })
);

const transports: winston.transport[] = [
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      logFormat
    ),
  }),
];

// Add file transport in production if log directory is writable
if (process.env.NODE_ENV === 'production') {
  try {
    // Ensure log directory exists and is writable
    if (!fs.existsSync(logPath)) {
      fs.mkdirSync(logPath, { recursive: true });
    }
    
    // Test if writable by checking access
    fs.accessSync(logPath, fs.constants.W_OK);
    
    transports.push(
      new winston.transports.File({
        filename: path.join(logPath, 'error.log'),
        level: 'error',
        format: logFormat,
      }),
      new winston.transports.File({
        filename: path.join(logPath, 'combined.log'),
        format: logFormat,
        maxsize: 5242880, // 5MB
        maxFiles: 5,
      })
    );
  } catch (err) {
    // If we can't write to the log directory, just use console logging
    console.warn(`Warning: Cannot write to log directory ${logPath}, using console logging only`);
  }
}

const winstonLogger = winston.createLogger({
  level: logLevel,
  format: logFormat,
  transports,
});

// Application logger with categories
export const logger = {
  info: (message: string, category?: string) => {
    winstonLogger.info(category ? `[${category}] ${message}` : message);
    addAppLog('info', message, category);
  },
  warn: (message: string, category?: string) => {
    winstonLogger.warn(category ? `[${category}] ${message}` : message);
    addAppLog('warn', message, category);
  },
  error: (message: string, category?: string) => {
    winstonLogger.error(category ? `[${category}] ${message}` : message);
    addAppLog('error', message, category);
  },
  debug: (message: string, category?: string) => {
    winstonLogger.debug(category ? `[${category}] ${message}` : message);
    addAppLog('debug', message, category);
  },
  // For HTTP request logging (morgan) - doesn't add to app buffer
  http: (message: string) => {
    winstonLogger.info(message);
  },
};

// Export function to get recent application logs
export function getRecentLogs(limit: number = 100, level?: string): Array<{ timestamp: string; level: string; message: string; category?: string }> {
  let logs = [...appLogBuffer];
  
  // Filter by level if specified
  if (level) {
    logs = logs.filter(log => log.level === level);
  }
  
  // Return most recent logs (reversed for newest first)
  return logs.slice(-limit).reverse();
}

// Export function to clear logs
export function clearLogs(): void {
  appLogBuffer.length = 0;
}

// Log startup message
addAppLog('info', 'Logger initialized', 'System');
