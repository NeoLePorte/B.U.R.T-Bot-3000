const xss = require('xss');
const { JSDOM } = require('jsdom');
const createDOMPurify = require('dompurify');
const logger = require('./logger');
const { MetricsCollector } = require('./metrics');

const { window } = new JSDOM('');
const DOMPurify = createDOMPurify(window);

const metrics = new MetricsCollector('security');

// Security configuration
const XSS_OPTIONS = {
  whiteList: {}, // No tags allowed
  stripIgnoreTag: true,
  stripIgnoreTagBody: ['script', 'style', 'xml']
};

// Sensitive patterns to remove
const SENSITIVE_PATTERNS = [
  /api[_-]?key/i,
  /auth[_-]?token/i,
  /password/i,
  /secret/i,
  /credential/i,
  /access[_-]?token/i,
  /ssh[_-]?key/i,
  /private[_-]?key/i
];

class Security {
  static sanitizeInput(input) {
    try {
      metrics.increment('sanitize_attempts');

      if (typeof input === 'string') {
        return this.sanitizeString(input);
      }

      if (Array.isArray(input)) {
        return input.map(item => this.sanitizeInput(item));
      }

      if (input && typeof input === 'object') {
        return this.sanitizeObject(input);
      }

      return input;
    } catch (error) {
      metrics.increment('sanitize_errors');
      logger.error('Error sanitizing input:', error);
      return null;
    }
  }

  static sanitizeString(str) {
    try {
      // Basic XSS protection
      let sanitized = xss(str, XSS_OPTIONS);

      // HTML sanitization
      sanitized = DOMPurify.sanitize(sanitized, {
        ALLOWED_TAGS: [],
        ALLOWED_ATTR: []
      });

      // Remove potential SQL injection patterns
      sanitized = sanitized
        .replace(/'/g, '\u2019')  // Unicode right single quotation mark
        .replace(/"/g, '\u201D')  // Unicode right double quotation mark
        .replace(/;/g, '\uFF1B')  // Unicode fullwidth semicolon
        .replace(/--/g, '\u2014\u2014')  // Unicode em dash
        .replace(/\/\*/g, '\uFF0F\uFF0A')  // Unicode fullwidth slash and asterisk
        .replace(/\*\//g, '\uFF0A\uFF0F');  // Unicode fullwidth asterisk and slash

      // Remove potential command injection characters
      sanitized = sanitized
        .replace(/\$/g, '＄')
        .replace(/`/g, '｀')
        .replace(/\|/g, '｜')
        .replace(/>/g, '＞')
        .replace(/</g, '＜')
        .replace(/&/g, '＆');

      return sanitized;
    } catch (error) {
      metrics.increment('string_sanitize_errors');
      logger.error('Error sanitizing string:', error);
      return '';
    }
  }

  static sanitizeObject(obj) {
    try {
      const sanitized = {};

      for (const [key, value] of Object.entries(obj)) {
        // Skip functions
        if (typeof value === 'function') continue;

        // Recursively sanitize nested objects and arrays
        if (value && typeof value === 'object') {
          sanitized[key] = Array.isArray(value) 
            ? value.map(item => this.sanitizeInput(item))
            : this.sanitizeObject(value);
          continue;
        }

        // Sanitize strings
        if (typeof value === 'string') {
          sanitized[key] = this.sanitizeString(value);
          continue;
        }

        // Keep other primitives as is
        sanitized[key] = value;
      }

      return sanitized;
    } catch (error) {
      metrics.increment('object_sanitize_errors');
      logger.error('Error sanitizing object:', error);
      return {};
    }
  }

  static removeSensitiveData(obj) {
    try {
      metrics.increment('sensitive_data_removal_attempts');
      
      const cleaned = {};

      for (const [key, value] of Object.entries(obj)) {
        // Check if key matches any sensitive patterns
        if (SENSITIVE_PATTERNS.some(pattern => pattern.test(key))) {
          cleaned[key] = '[REDACTED]';
          continue;
        }

        // Recursively clean nested objects and arrays
        if (value && typeof value === 'object') {
          cleaned[key] = Array.isArray(value)
            ? value.map(item => 
                typeof item === 'object' ? this.removeSensitiveData(item) : item
              )
            : this.removeSensitiveData(value);
          continue;
        }

        cleaned[key] = value;
      }

      return cleaned;
    } catch (error) {
      metrics.increment('sensitive_data_removal_errors');
      logger.error('Error removing sensitive data:', error);
      return {};
    }
  }

  static validateOrigin(origin) {
    try {
      metrics.increment('origin_validation_attempts');
      
      // List of allowed origins
      const allowedOrigins = [
        'https://discord.com',
        'https://ptb.discord.com',
        'https://canary.discord.com'
      ];

      if (!origin) return false;

      const url = new URL(origin);
      return allowedOrigins.includes(url.origin);
    } catch (error) {
      metrics.increment('origin_validation_errors');
      logger.error('Error validating origin:', error);
      return false;
    }
  }

  static validateToken(token) {
    try {
      metrics.increment('token_validation_attempts');
      
      if (!token) return false;

      // Basic Discord token format validation
      const tokenPattern = /^[A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]{6}\.[A-Za-z0-9_-]{27}$/;
      return tokenPattern.test(token);
    } catch (error) {
      metrics.increment('token_validation_errors');
      logger.error('Error validating token:', error);
      return false;
    }
  }
}

module.exports = {
  sanitizeInput: Security.sanitizeInput.bind(Security),
  removeSensitiveData: Security.removeSensitiveData.bind(Security),
  validateOrigin: Security.validateOrigin.bind(Security),
  validateToken: Security.validateToken.bind(Security)
}; 