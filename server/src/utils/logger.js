/**
 * Winston Logger
 * ──────────────
 * Structured JSON logging for production, colorized console for development.
 *
 * WHY Winston?
 *   • Transport-based architecture (console, file, HTTP, etc.)
 *   • Log levels follow RFC 5424 (error, warn, info, http, debug)
 *   • JSON format is essential for log aggregation (ELK, Datadog, CloudWatch)
 *
 * SECURITY:
 *   • NEVER log passwords, tokens, or sensitive PII
 *   • Sanitize user input before logging
 *   • Use logger.error() for caught exceptions, not console.error()
 */
const { createLogger, format, transports } = require('winston');
const config = require('../config');

const { combine, timestamp, printf, colorize, errors, json } = format;

// ── Human-readable format for local development ──
const devFormat = combine(
  colorize({ all: true }),
  timestamp({ format: 'HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ timestamp: ts, level, message, stack, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${ts} [${level}]: ${stack || message}${metaStr}`;
  })
);

// ── Structured JSON for production (log aggregation) ──
const prodFormat = combine(
  timestamp(),
  errors({ stack: true }),
  json()
);

const logger = createLogger({
  level: config.nodeEnv === 'development' ? 'debug' : 'info',
  format: config.nodeEnv === 'development' ? devFormat : prodFormat,
  defaultMeta: { service: 'bankflow-api' },
  transports: [
    new transports.Console(),
  ],
  // Don't crash the app on uncaught exceptions in logging
  exitOnError: false,
});

// ── In production, also write errors to a file ──
if (config.nodeEnv === 'production') {
  logger.add(
    new transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880, // 5 MB
      maxFiles: 5,
    })
  );
  logger.add(
    new transports.File({
      filename: 'logs/combined.log',
      maxsize: 5242880,
      maxFiles: 5,
    })
  );
}

module.exports = logger;
