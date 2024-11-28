const { BackroomsProcessor } = require('./backroomsProcessor');
const { ContextManager } = require('./contextManager');
const redis = require('../services/redis');
const mongo = require('../services/mongodb');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');
const { validate } = require('../utils/validator');
const { sanitizeInput } = require('../utils/security');
const { MetricsCollector } = require('../utils/metrics');

const metrics = new MetricsCollector('memory_processor');

class MemoryProcessor {
  static async processInteraction(interaction) {
    const startTime = Date.now();
    metrics.increment('interaction_processing_attempts');

    try {
      let memory;
      
      // Create memory based on interaction type
      if (interaction.type === 'message') {
        memory = {
          id: uuidv4(),
          type: 'message',
          content: interaction.content,
          userId: interaction.author.id,
          timestamp: new Date(),
          metadata: {
            channel: interaction.channel.id,
            guild: interaction.guild?.id,
            hasImages: interaction.attachments.size > 0,
            isCommand: interaction.content.startsWith('!'),
            isMention: interaction.mentions.users.has(interaction.client.user.id),
            isThread: interaction.channel.isThread(),
            parentChannel: interaction.channel.parentId
          }
        };
      } else if (interaction.type === 'reaction') {
        memory = {
          id: uuidv4(),
          type: 'reaction',
          content: `${interaction.user.username} reacted with ${interaction.emoji.name}`,
          userId: interaction.user.id,
          timestamp: new Date(),
          metadata: {
            channel: interaction.message.channel.id,
            guild: interaction.message.guild?.id,
            messageId: interaction.message.id,
            emoji: interaction.emoji.name,
            messageContent: interaction.message.content
          }
        };
      } else if (interaction.type === 'burt_response') {
        memory = {
          id: uuidv4(),
          type: 'burt_response',
          content: interaction.content,
          userId: 'BURT',
          timestamp: new Date(),
          metadata: {
            channel: interaction.channel.id,
            guild: interaction.guild?.id,
            triggerMemoryId: interaction.triggerMemoryId,
            responseType: interaction.responseType,
            emotionalContext: interaction.emotionalContext
          }
        };
      }

      if (!memory) {
        throw new Error('Invalid interaction type');
      }

      // Validate memory object
      if (!validate.memory(memory)) {
        throw new Error('Invalid memory format');
      }

      // Sanitize memory data
      const sanitizedMemory = sanitizeInput(memory);

      // Process through backrooms
      const backroomsResult = await BackroomsProcessor.process(sanitizedMemory);
      
      // Enhance memory with backrooms analysis
      const enhancedMemory = {
        ...sanitizedMemory,
        metadata: {
          ...sanitizedMemory.metadata,
          backroomsLevel: backroomsResult.backroomsLevel,
          patterns: backroomsResult.patterns,
          connections: backroomsResult.connections,
          insights: backroomsResult.insights,
          emotionalContext: backroomsResult.emotionalContext,
          processingMetadata: {
            processingTime: Date.now() - startTime,
            version: '2.0.0'
          }
        }
      };

      // Store in Redis for quick access
      const redisSuccess = await this.storeInRedis(enhancedMemory);
      if (!redisSuccess) {
        logger.warn('Failed to store memory in Redis', { memoryId: enhancedMemory.id });
      }

      // Archive in MongoDB
      const mongoSuccess = await this.archiveInMongo(enhancedMemory);
      if (!mongoSuccess) {
        logger.warn('Failed to archive memory in MongoDB', { memoryId: enhancedMemory.id });
      }

      metrics.timing('memory_processing_time', Date.now() - startTime);
      return enhancedMemory;

    } catch (error) {
      metrics.increment('processing_errors');
      logger.error('Error processing memory:', error);
      return null;
    }
  }

  static async getContext(query) {
    try {
      metrics.increment('context_requests');
      const startTime = Date.now();
      
      const context = await ContextManager.getRelevantContext(query);
      
      metrics.timing('context_retrieval_time', Date.now() - startTime);
      return context;
    } catch (error) {
      metrics.increment('context_errors');
      logger.error('Error getting memory context:', error);
      return null;
    }
  }

  static async storeInRedis(memory) {
    try {
      metrics.increment('redis_store_attempts');
      const startTime = Date.now();

      // Store the full memory object
      await redis.storeMemory(memory);

      // Store in user's recent memories list
      await redis.client.lpush(`user:${memory.userId}:memories`, memory.id);
      await redis.client.ltrim(`user:${memory.userId}:memories`, 0, 99); // Keep last 100

      // Store in channel's recent memories
      await redis.client.lpush(`channel:${memory.metadata.channel}:memories`, memory.id);
      await redis.client.ltrim(`channel:${memory.metadata.channel}:memories`, 0, 49); // Keep last 50

      // Store patterns if they exist
      if (memory.metadata.patterns) {
        for (const pattern of memory.metadata.patterns) {
          await redis.client.lpush(`pattern:${pattern.id}:memories`, memory.id);
          await redis.client.expire(`pattern:${pattern.id}:memories`, 60 * 60 * 24 * 7); // 1 week
        }
      }

      // Update backrooms level
      if (memory.metadata.backroomsLevel !== undefined) {
        await redis.client.set(
          `backrooms:${memory.userId}:level`,
          memory.metadata.backroomsLevel,
          'EX',
          60 * 60 * 24 * 3 // 3 days
        );
      }

      metrics.timing('redis_store_time', Date.now() - startTime);
      return true;
    } catch (error) {
      metrics.increment('redis_store_errors');
      logger.error('Error storing memory in Redis:', error);
      return false;
    }
  }

  static async archiveInMongo(memory) {
    try {
      metrics.increment('mongo_archive_attempts');
      const startTime = Date.now();

      // Archive the main memory document
      await mongo.collections.memories.insertOne({
        ...memory,
        archivedAt: new Date()
      });

      // Store patterns
      if (memory.metadata.patterns) {
        const patternOps = memory.metadata.patterns.map(pattern => ({
          updateOne: {
            filter: { id: pattern.id },
            update: {
              $inc: { frequency: 1 },
              $set: { lastSeen: new Date() },
              $push: {
                examples: {
                  $each: [memory.id],
                  $slice: -50 // Keep last 50 examples
                }
              }
            },
            upsert: true
          }
        }));

        await mongo.collections.patterns.bulkWrite(patternOps);
      }

      // Store insights
      if (memory.metadata.insights) {
        await mongo.collections.insights.insertMany(
          memory.metadata.insights.map(insight => ({
            ...insight,
            memoryId: memory.id,
            userId: memory.userId,
            timestamp: memory.timestamp,
            backroomsLevel: memory.metadata.backroomsLevel
          }))
        );
      }

      // Store connections
      if (memory.metadata.connections) {
        await mongo.collections.connections.insertMany(
          memory.metadata.connections.map(connection => ({
            ...connection,
            timestamp: new Date(),
            sourceId: memory.id
          }))
        );
      }

      metrics.timing('mongo_archive_time', Date.now() - startTime);
      return true;
    } catch (error) {
      metrics.increment('mongo_archive_errors');
      logger.error('Error archiving memory in MongoDB:', error);
      return false;
    }
  }
}

module.exports = { MemoryProcessor }; 