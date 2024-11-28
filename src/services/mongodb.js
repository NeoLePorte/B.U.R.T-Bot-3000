const { MongoClient } = require('mongodb');
const logger = require('../utils/logger');
const { MetricsCollector } = require('../utils/metrics');
const { sanitizeInput } = require('../utils/security');

const metrics = new MetricsCollector('mongodb');

class MongoDBService {
  constructor() {
    this.client = null;
    this.db = null;
    this.collections = {
      memories: null,
      patterns: null,
      connections: null,
      insights: null,
      metrics: null
    };

    this.connect();
  }

  async connect() {
    try {
      const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/burt';
      this.client = await MongoClient.connect(uri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 5000
      });

      this.db = this.client.db();
      
      // Initialize collections
      this.collections.memories = this.db.collection('memories');
      this.collections.patterns = this.db.collection('patterns');
      this.collections.connections = this.db.collection('connections');
      this.collections.insights = this.db.collection('insights');
      this.collections.metrics = this.db.collection('metrics');

      // Create indexes
      await Promise.all([
        this.collections.memories.createIndex({ userId: 1 }),
        this.collections.memories.createIndex({ 'metadata.channel': 1 }),
        this.collections.memories.createIndex({ 'metadata.backroomsLevel': 1 }),
        this.collections.memories.createIndex({ timestamp: 1 }),
        this.collections.patterns.createIndex({ type: 1 }),
        this.collections.connections.createIndex({ type: 1 }),
        this.collections.connections.createIndex({ source: 1 }),
        this.collections.connections.createIndex({ target: 1 }),
        this.collections.insights.createIndex({ type: 1 }),
        this.collections.metrics.createIndex({ timestamp: 1 })
      ]);

      logger.info('Connected to MongoDB');
      metrics.increment('connections');
      metrics.gauge('connected', 1);
    } catch (error) {
      logger.error('MongoDB connection error:', error);
      metrics.increment('connection_errors');
      metrics.gauge('connected', 0);
      throw error;
    }
  }

  async archiveMemory(memory) {
    const timer = metrics.startTimer('archive_memory');
    try {
      const sanitizedMemory = sanitizeInput(memory);
      
      // Archive the main memory document
      await this.collections.memories.insertOne({
        ...sanitizedMemory,
        archivedAt: new Date()
      });

      // Archive patterns
      if (memory.metadata.patterns) {
        await this.collections.patterns.insertMany(
          memory.metadata.patterns.map(pattern => ({
            ...pattern,
            memoryId: memory.id,
            userId: memory.userId,
            channelId: memory.metadata.channel,
            timestamp: memory.timestamp,
            archivedAt: new Date()
          }))
        );
      }

      // Archive connections
      if (memory.metadata.connections) {
        await this.collections.connections.insertMany(
          memory.metadata.connections.map(connection => ({
            ...connection,
            memoryId: memory.id,
            userId: memory.userId,
            channelId: memory.metadata.channel,
            timestamp: memory.timestamp,
            archivedAt: new Date()
          }))
        );
      }

      // Archive insights
      if (memory.metadata.insights) {
        await this.collections.insights.insertMany(
          memory.metadata.insights.map(insight => ({
            ...insight,
            memoryId: memory.id,
            userId: memory.userId,
            channelId: memory.metadata.channel,
            timestamp: memory.timestamp,
            archivedAt: new Date()
          }))
        );
      }

      metrics.increment('memories_archived');
      timer.stop();
      return true;
    } catch (error) {
      logger.error('Error archiving memory to MongoDB:', error);
      metrics.increment('archive_errors');
      timer.stop();
      return false;
    }
  }

  async findConnections(query) {
    const timer = metrics.startTimer('find_connections');
    try {
      const { userId, channelId, type, minStrength = 0, limit = 100 } = query;
      
      const filter = {
        strength: { $gte: minStrength }
      };

      if (userId) filter.userId = userId;
      if (channelId) filter.channelId = channelId;
      if (type) filter.type = type;

      const connections = await this.collections.connections
        .find(filter)
        .sort({ strength: -1 })
        .limit(limit)
        .toArray();

      metrics.increment('connections_retrieved');
      timer.stop();
      return connections;
    } catch (error) {
      logger.error('Error finding connections in MongoDB:', error);
      metrics.increment('find_connections_errors');
      timer.stop();
      return [];
    }
  }

  async findPatterns(query) {
    const timer = metrics.startTimer('find_patterns');
    try {
      const { userId, channelId, type, minConfidence = 0, limit = 100 } = query;
      
      const filter = {
        confidence: { $gte: minConfidence }
      };

      if (userId) filter.userId = userId;
      if (channelId) filter.channelId = channelId;
      if (type) filter.type = type;

      const patterns = await this.collections.patterns
        .find(filter)
        .sort({ confidence: -1 })
        .limit(limit)
        .toArray();

      metrics.increment('patterns_retrieved');
      timer.stop();
      return patterns;
    } catch (error) {
      logger.error('Error finding patterns in MongoDB:', error);
      metrics.increment('find_patterns_errors');
      timer.stop();
      return [];
    }
  }

  async findInsights(query) {
    const timer = metrics.startTimer('find_insights');
    try {
      const { userId, channelId, type, minConfidence = 0, limit = 100 } = query;
      
      const filter = {
        confidence: { $gte: minConfidence }
      };

      if (userId) filter.userId = userId;
      if (channelId) filter.channelId = channelId;
      if (type) filter.type = type;

      const insights = await this.collections.insights
        .find(filter)
        .sort({ confidence: -1 })
        .limit(limit)
        .toArray();

      metrics.increment('insights_retrieved');
      timer.stop();
      return insights;
    } catch (error) {
      logger.error('Error finding insights in MongoDB:', error);
      metrics.increment('find_insights_errors');
      timer.stop();
      return [];
    }
  }

  async findMemoriesByBackroomsLevel(query) {
    const timer = metrics.startTimer('find_memories_by_backrooms_level');
    try {
      const { minLevel = 0, maxLevel = 100, userId, channelId, limit = 100 } = query;
      
      const filter = {
        'metadata.backroomsLevel': {
          $gte: minLevel,
          $lte: maxLevel
        }
      };

      if (userId) filter.userId = userId;
      if (channelId) filter['metadata.channel'] = channelId;

      const memories = await this.collections.memories
        .find(filter)
        .sort({ 'metadata.backroomsLevel': -1 })
        .limit(limit)
        .toArray();

      metrics.increment('backrooms_memories_retrieved');
      timer.stop();
      return memories;
    } catch (error) {
      logger.error('Error finding memories by backrooms level in MongoDB:', error);
      metrics.increment('find_backrooms_memories_errors');
      timer.stop();
      return [];
    }
  }

  async storeMetrics(metricsData) {
    const timer = metrics.startTimer('store_metrics');
    try {
      await this.collections.metrics.insertOne({
        ...metricsData,
        timestamp: new Date()
      });

      metrics.increment('metrics_stored');
      timer.stop();
      return true;
    } catch (error) {
      logger.error('Error storing metrics in MongoDB:', error);
      metrics.increment('store_metrics_errors');
      timer.stop();
      return false;
    }
  }

  async close() {
    try {
      if (this.client) {
        await this.client.close();
        metrics.gauge('connected', 0);
        logger.info('MongoDB connection closed');
      }
    } catch (error) {
      logger.error('Error closing MongoDB connection:', error);
      metrics.increment('close_errors');
    }
  }
}

module.exports = new MongoDBService(); 