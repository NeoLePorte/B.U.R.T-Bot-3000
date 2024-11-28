const Redis = require('ioredis');
const logger = require('../utils/logger');
const { MetricsCollector } = require('../utils/metrics');
const { sanitizeInput } = require('../utils/security');

const metrics = new MetricsCollector('redis');

class RedisService {
  constructor() {
    this.client = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      retryStrategy: times => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      }
    });

    this.client.on('error', error => {
      logger.error('Redis error:', error);
      metrics.increment('errors');
    });

    this.client.on('connect', () => {
      logger.info('Connected to Redis');
      metrics.increment('connections');
    });

    // Initialize metrics
    metrics.gauge('connected', 1);
  }

  async storeMemory(memory) {
    const timer = metrics.startTimer('store_memory');
    try {
      const sanitizedMemory = sanitizeInput(memory);
      
      // Store the full memory object
      await this.client.hset(
        `memory:${memory.id}`,
        'data',
        JSON.stringify(sanitizedMemory)
      );

      // Store memory ID in user's memory list
      await this.client.lpush(
        `user:${memory.userId}:memories`,
        memory.id
      );

      // Store memory ID in channel's memory list
      await this.client.lpush(
        `channel:${memory.metadata.channel}:memories`,
        memory.id
      );

      // Index patterns for quick lookup
      if (memory.metadata.patterns) {
        for (const pattern of memory.metadata.patterns) {
          await this.client.sadd(
            `pattern:${pattern.type}`,
            memory.id
          );
        }
      }

      // Index connections
      if (memory.metadata.connections) {
        for (const connection of memory.metadata.connections) {
          await this.client.sadd(
            `connection:${connection.type}`,
            memory.id
          );
        }
      }

      // Store backrooms level for quick access
      if (memory.metadata.backroomsLevel) {
        await this.client.zadd(
          'backrooms:levels',
          memory.metadata.backroomsLevel,
          memory.id
        );
      }

      metrics.increment('memories_stored');
      timer.stop();
      return true;
    } catch (error) {
      logger.error('Error storing memory in Redis:', error);
      metrics.increment('store_errors');
      timer.stop();
      return false;
    }
  }

  async getMemory(memoryId) {
    const timer = metrics.startTimer('get_memory');
    try {
      const data = await this.client.hget(`memory:${memoryId}`, 'data');
      if (!data) {
        metrics.increment('memory_misses');
        return null;
      }

      metrics.increment('memory_hits');
      timer.stop();
      return JSON.parse(data);
    } catch (error) {
      logger.error('Error getting memory from Redis:', error);
      metrics.increment('get_errors');
      timer.stop();
      return null;
    }
  }

  async getUserMemories(userId, limit = 100) {
    const timer = metrics.startTimer('get_user_memories');
    try {
      const memoryIds = await this.client.lrange(
        `user:${userId}:memories`,
        0,
        limit - 1
      );

      const memories = await Promise.all(
        memoryIds.map(id => this.getMemory(id))
      );

      metrics.increment('user_memories_retrieved');
      timer.stop();
      return memories.filter(m => m !== null);
    } catch (error) {
      logger.error('Error getting user memories from Redis:', error);
      metrics.increment('get_user_memories_errors');
      timer.stop();
      return [];
    }
  }

  async getChannelMemories(channelId, limit = 100) {
    const timer = metrics.startTimer('get_channel_memories');
    try {
      const memoryIds = await this.client.lrange(
        `channel:${channelId}:memories`,
        0,
        limit - 1
      );

      const memories = await Promise.all(
        memoryIds.map(id => this.getMemory(id))
      );

      metrics.increment('channel_memories_retrieved');
      timer.stop();
      return memories.filter(m => m !== null);
    } catch (error) {
      logger.error('Error getting channel memories from Redis:', error);
      metrics.increment('get_channel_memories_errors');
      timer.stop();
      return [];
    }
  }

  async getMemoriesByPattern(patternType, limit = 100) {
    const timer = metrics.startTimer('get_memories_by_pattern');
    try {
      const memoryIds = await this.client.srandmember(
        `pattern:${patternType}`,
        limit
      );

      const memories = await Promise.all(
        memoryIds.map(id => this.getMemory(id))
      );

      metrics.increment('pattern_memories_retrieved');
      timer.stop();
      return memories.filter(m => m !== null);
    } catch (error) {
      logger.error('Error getting memories by pattern from Redis:', error);
      metrics.increment('get_pattern_memories_errors');
      timer.stop();
      return [];
    }
  }

  async getMemoriesByBackroomsLevel(minLevel, maxLevel, limit = 100) {
    const timer = metrics.startTimer('get_memories_by_backrooms_level');
    try {
      const memoryIds = await this.client.zrangebyscore(
        'backrooms:levels',
        minLevel,
        maxLevel,
        'LIMIT',
        0,
        limit
      );

      const memories = await Promise.all(
        memoryIds.map(id => this.getMemory(id))
      );

      metrics.increment('backrooms_memories_retrieved');
      timer.stop();
      return memories.filter(m => m !== null);
    } catch (error) {
      logger.error('Error getting memories by backrooms level from Redis:', error);
      metrics.increment('get_backrooms_memories_errors');
      timer.stop();
      return [];
    }
  }

  async deleteMemory(memoryId) {
    const timer = metrics.startTimer('delete_memory');
    try {
      const memory = await this.getMemory(memoryId);
      if (!memory) {
        return false;
      }

      // Remove from all indexes
      await Promise.all([
        this.client.del(`memory:${memoryId}`),
        this.client.lrem(`user:${memory.userId}:memories`, 0, memoryId),
        this.client.lrem(`channel:${memory.metadata.channel}:memories`, 0, memoryId),
        this.client.zrem('backrooms:levels', memoryId),
        ...(memory.metadata.patterns || []).map(pattern =>
          this.client.srem(`pattern:${pattern.type}`, memoryId)
        ),
        ...(memory.metadata.connections || []).map(connection =>
          this.client.srem(`connection:${connection.type}`, memoryId)
        )
      ]);

      metrics.increment('memories_deleted');
      timer.stop();
      return true;
    } catch (error) {
      logger.error('Error deleting memory from Redis:', error);
      metrics.increment('delete_errors');
      timer.stop();
      return false;
    }
  }

  async close() {
    try {
      await this.client.quit();
      metrics.gauge('connected', 0);
      logger.info('Redis connection closed');
    } catch (error) {
      logger.error('Error closing Redis connection:', error);
      metrics.increment('close_errors');
    }
  }
}

module.exports = new RedisService(); 