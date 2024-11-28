const StatsD = require('hot-shots');
const logger = require('./logger');

// Initialize StatsD client
const statsd = new StatsD({
  host: process.env.STATSD_HOST || 'localhost',
  port: parseInt(process.env.STATSD_PORT || '8125'),
  prefix: 'burt.',
  errorHandler: error => {
    logger.error('StatsD error:', error);
  }
});

class MetricsCollector {
  constructor(namespace) {
    this.namespace = namespace;
    this.startTime = Date.now();

    // Initialize basic metrics
    this.increment('starts');
    this.gauge('uptime', 0);

    // Start uptime tracking
    this.trackUptime();
  }

  // Track how long the service has been running
  trackUptime() {
    setInterval(() => {
      const uptime = (Date.now() - this.startTime) / 1000; // in seconds
      this.gauge('uptime', uptime);
    }, 60000); // Update every minute
  }

  // Increment a counter
  increment(metric, value = 1, tags = {}) {
    try {
      const tagString = this.formatTags(tags);
      statsd.increment(`${this.namespace}.${metric}${tagString}`, value);
    } catch (error) {
      logger.error('Error incrementing metric:', {
        namespace: this.namespace,
        metric,
        error: error.message
      });
    }
  }

  // Record timing information
  timing(metric, time, tags = {}) {
    try {
      const tagString = this.formatTags(tags);
      statsd.timing(`${this.namespace}.${metric}${tagString}`, time);
    } catch (error) {
      logger.error('Error recording timing:', {
        namespace: this.namespace,
        metric,
        error: error.message
      });
    }
  }

  // Set a gauge value
  gauge(metric, value, tags = {}) {
    try {
      const tagString = this.formatTags(tags);
      statsd.gauge(`${this.namespace}.${metric}${tagString}`, value);
    } catch (error) {
      logger.error('Error setting gauge:', {
        namespace: this.namespace,
        metric,
        error: error.message
      });
    }
  }

  // Record a histogram value
  histogram(metric, value, tags = {}) {
    try {
      const tagString = this.formatTags(tags);
      statsd.histogram(`${this.namespace}.${metric}${tagString}`, value);
    } catch (error) {
      logger.error('Error recording histogram:', {
        namespace: this.namespace,
        metric,
        error: error.message
      });
    }
  }

  // Start timing an event
  startTimer(metric, tags = {}) {
    try {
      const start = Date.now();
      return {
        stop: () => {
          const duration = Date.now() - start;
          this.timing(metric, duration, tags);
          return duration;
        }
      };
    } catch (error) {
      logger.error('Error starting timer:', {
        namespace: this.namespace,
        metric,
        error: error.message
      });
      return { stop: () => 0 };
    }
  }

  // Record memory usage
  recordMemoryUsage() {
    try {
      const usage = process.memoryUsage();
      this.gauge('memory.heapTotal', usage.heapTotal);
      this.gauge('memory.heapUsed', usage.heapUsed);
      this.gauge('memory.rss', usage.rss);
      this.gauge('memory.external', usage.external);
    } catch (error) {
      logger.error('Error recording memory usage:', {
        namespace: this.namespace,
        error: error.message
      });
    }
  }

  // Record event loop lag
  recordEventLoopLag() {
    try {
      const start = Date.now();
      setImmediate(() => {
        const lag = Date.now() - start;
        this.timing('eventloop.lag', lag);
      });
    } catch (error) {
      logger.error('Error recording event loop lag:', {
        namespace: this.namespace,
        error: error.message
      });
    }
  }

  // Format tags for StatsD
  formatTags(tags) {
    try {
      if (!tags || Object.keys(tags).length === 0) return '';
      
      return ',' + Object.entries(tags)
        .map(([key, value]) => `${key}:${value}`)
        .join(',');
    } catch (error) {
      logger.error('Error formatting tags:', {
        namespace: this.namespace,
        error: error.message
      });
      return '';
    }
  }

  // Start collecting system metrics
  startSystemMetrics(interval = 60000) {
    try {
      // Record initial metrics
      this.recordMemoryUsage();
      this.recordEventLoopLag();

      // Set up interval for continuous monitoring
      return setInterval(() => {
        this.recordMemoryUsage();
        this.recordEventLoopLag();
      }, interval);
    } catch (error) {
      logger.error('Error starting system metrics:', {
        namespace: this.namespace,
        error: error.message
      });
    }
  }

  // Record backrooms-specific metrics
  recordBackroomsMetrics(memory) {
    try {
      if (!memory || !memory.metadata) return;

      this.gauge('backrooms.level', memory.metadata.backroomsLevel || 0);
      this.gauge('patterns.count', memory.metadata.patterns?.length || 0);
      this.gauge('connections.count', memory.metadata.connections?.length || 0);
      this.gauge('insights.count', memory.metadata.insights?.length || 0);
      
      if (memory.metadata.emotionalContext) {
        this.gauge('emotional.intensity', memory.metadata.emotionalContext.intensity || 0);
        this.gauge('emotional.stability', memory.metadata.emotionalContext.stability || 0);
        this.gauge('emotional.contagion', memory.metadata.emotionalContext.contagion || 0);
      }
    } catch (error) {
      logger.error('Error recording backrooms metrics:', {
        namespace: this.namespace,
        error: error.message
      });
    }
  }
}

module.exports = {
  MetricsCollector,
  defaultCollector: new MetricsCollector('default')
}; 