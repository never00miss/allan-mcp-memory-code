import pino from 'pino';
import fs from 'fs';
import path from 'path';

const isDev = process.env.NODE_ENV !== 'production';
const isCli = process.env.ALLAN_CLI_MODE === '1';

// Get project root (where package.json is)
const projectRoot = process.env.ALLAN_LOG_DIR || path.resolve(__dirname, '../../..');

// Ensure logs directory exists
const logsDir = path.join(projectRoot, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Log file path (daily rotation by date)
const logFile = path.join(logsDir, `allan-memory-${new Date().toISOString().split('T')[0]}.log`);

// Create write stream for file logging
const fileStream = fs.createWriteStream(logFile, { flags: 'a' });

// Build logger based on mode
let logger;

if (isCli) {
  // CLI mode: file only (quiet console)
  logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    base: { service: 'allan-memory' }
  }, fileStream);
} else if (isDev) {
  // Dev/Server mode: console (pretty) + file
  // Use pino.multistream for dual output
  const prettyStream = pino.transport({
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname'
    }
  });
  
  logger = pino({
    level: process.env.LOG_LEVEL || 'debug',
    base: { service: 'allan-memory' }
  }, pino.multistream([
    { stream: prettyStream },
    { stream: fileStream }
  ]));
} else {
  // Production: file only (JSON format)
  logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    base: { service: 'allan-memory' }
  }, fileStream);
}

// Flush function for CLI (ensures logs are written before process.exit)
export const flushLogs = () => {
  return new Promise((resolve) => {
    // End stream to force flush
    fileStream.end(() => {
      setTimeout(resolve, 50); // Small delay for OS buffer
    });
  });
};

export default logger;
