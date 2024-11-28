const winston = require('winston');
const { format } = winston;

// Custom format for BURT's chaotic logging style
const burtFormat = format.printf(({ level, message, timestamp, ...metadata }) => {
  let msg = `${timestamp} [${level.toUpperCase()}] `;
  
  // Add chaotic prefix based on log level
  switch(level) {
    case 'error':
      msg += '🚨 [REALITY FRACTURE] ';
      break;
    case 'warn':
      msg += '⚠️ [PARANOID WARNING] ';
      break;
    case 'info':
      msg += '🤖 [BURT INSIGHT] ';
      break;
    case 'debug':
      msg += '🔍 [BACKROOMS DEBUG] ';
      break;
    default:
      msg += '📝 [MEMORY LOG] ';
  }

  msg += message;

  // Add metadata if present
  if (Object.keys(metadata).length > 0) {
    msg += `\n${JSON.stringify(metadata, null, 2)}`;
  }

  return msg;
});

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: format.combine(
    format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    format.errors({ stack: true }),
    format.splat(),
    format.json(),
    burtFormat
  ),
  defaultMeta: { service: 'burt-bot' },
  transports: [
    // Write all logs error (and below) to error.log
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      tailable: true
    }),
    // Write all logs to combined.log
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 10485760, // 10MB
      maxFiles: 5,
      tailable: true
    })
  ]
});

// If we're not in production, log to console with colors
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: format.combine(
      format.colorize(),
      format.simple(),
      burtFormat
    )
  }));
}

// Add error event handler
logger.on('error', (error) => {
  console.error('Logger error:', error);
});

// Add custom logging methods for BURT-specific events
logger.backrooms = (message, metadata = {}) => {
  logger.info(message, { 
    ...metadata, 
    context: 'backrooms',
    timestamp: new Date().toISOString()
  });
};

logger.pattern = (message, metadata = {}) => {
  logger.info(message, {
    ...metadata,
    context: 'pattern',
    timestamp: new Date().toISOString()
  });
};

logger.memory = (message, metadata = {}) => {
  logger.info(message, {
    ...metadata,
    context: 'memory',
    timestamp: new Date().toISOString()
  });
};

logger.reality = (message, metadata = {}) => {
  logger.warn(message, {
    ...metadata,
    context: 'reality',
    timestamp: new Date().toISOString()
  });
};

logger.fracture = (message, metadata = {}) => {
  logger.error(message, {
    ...metadata,
    context: 'fracture',
    timestamp: new Date().toISOString()
  });
};

// Export logger instance
module.exports = logger; 