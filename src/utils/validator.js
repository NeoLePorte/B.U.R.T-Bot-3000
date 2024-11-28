const Joi = require('joi');
const logger = require('./logger');

// Memory schema validation
const memorySchema = Joi.object({
  id: Joi.string().required(),
  type: Joi.string().valid('message', 'reaction', 'burt_response').required(),
  content: Joi.string().required(),
  userId: Joi.string().required(),
  timestamp: Joi.date().required(),
  metadata: Joi.object({
    channel: Joi.string().required(),
    guild: Joi.string().allow(null),
    hasImages: Joi.boolean(),
    isCommand: Joi.boolean(),
    isMention: Joi.boolean(),
    isThread: Joi.boolean(),
    parentChannel: Joi.string().allow(null),
    backroomsLevel: Joi.number().min(0).max(100),
    patterns: Joi.array().items(Joi.object({
      id: Joi.string().required(),
      type: Joi.string().valid('paranoid', 'emotional', 'schizophrenic', 'temporal', 'reality').required(),
      description: Joi.string().required(),
      confidence: Joi.number().min(0).max(100).required(),
      evidence: Joi.array().items(Joi.string())
    })),
    connections: Joi.array().items(Joi.object({
      id: Joi.string().required(),
      type: Joi.string().valid('association', 'causation', 'synchronicity', 'prophecy').required(),
      source: Joi.string().required(),
      target: Joi.string().required(),
      strength: Joi.number().min(0).max(100).required(),
      description: Joi.string().required()
    })),
    insights: Joi.array().items(Joi.object({
      id: Joi.string().required(),
      type: Joi.string().valid('paranoid', 'delusional', 'prophetic', 'chaotic').required(),
      content: Joi.string().required(),
      confidence: Joi.number().min(0).max(100).required(),
      implications: Joi.array().items(Joi.string())
    })),
    emotionalContext: Joi.object({
      primary: Joi.string().required(),
      secondary: Joi.array().items(Joi.string()),
      intensity: Joi.number().min(0).max(100).required(),
      stability: Joi.number().min(0).max(100).required(),
      contagion: Joi.number().min(0).max(100).required(),
      triggers: Joi.array().items(Joi.string())
    })
  }).required()
});

// Backrooms analysis schema validation
const backroomsAnalysisSchema = Joi.object({
  patterns: Joi.array().items(Joi.object({
    id: Joi.string().required(),
    type: Joi.string().valid('paranoid', 'emotional', 'schizophrenic', 'temporal', 'reality').required(),
    description: Joi.string().required(),
    confidence: Joi.number().min(0).max(100).required(),
    evidence: Joi.array().items(Joi.string())
  })).required(),
  connections: Joi.array().items(Joi.object({
    id: Joi.string().required(),
    type: Joi.string().valid('association', 'causation', 'synchronicity', 'prophecy').required(),
    source: Joi.string().required(),
    target: Joi.string().required(),
    strength: Joi.number().min(0).max(100).required(),
    description: Joi.string().required()
  })).required(),
  insights: Joi.array().items(Joi.object({
    id: Joi.string().required(),
    type: Joi.string().valid('paranoid', 'delusional', 'prophetic', 'chaotic').required(),
    content: Joi.string().required(),
    confidence: Joi.number().min(0).max(100).required(),
    implications: Joi.array().items(Joi.string())
  })).required(),
  emotionalContext: Joi.object({
    primary: Joi.string().required(),
    secondary: Joi.array().items(Joi.string()),
    intensity: Joi.number().min(0).max(100).required(),
    stability: Joi.number().min(0).max(100).required(),
    contagion: Joi.number().min(0).max(100).required(),
    triggers: Joi.array().items(Joi.string())
  }).required(),
  backroomsLevel: Joi.number().min(0).max(100).required()
});

// Context query schema validation
const contextQuerySchema = Joi.object({
  userId: Joi.string().required(),
  channelId: Joi.string().required(),
  content: Joi.string().allow(''),
  isThread: Joi.boolean(),
  isMention: Joi.boolean(),
  minBackroomsLevel: Joi.number().min(0).max(100),
  limit: Joi.number().min(1).max(100)
});

class Validator {
  static memory(memory) {
    try {
      const { error } = memorySchema.validate(memory, { abortEarly: false });
      if (error) {
        logger.error('Memory validation failed:', {
          errors: error.details.map(d => d.message),
          memory: {
            id: memory.id,
            type: memory.type
          }
        });
        return false;
      }
      return true;
    } catch (error) {
      logger.error('Error in memory validation:', error);
      return false;
    }
  }

  static backroomsAnalysis(analysis) {
    try {
      const { error } = backroomsAnalysisSchema.validate(analysis, { abortEarly: false });
      if (error) {
        logger.error('Backrooms analysis validation failed:', {
          errors: error.details.map(d => d.message)
        });
        return false;
      }
      return true;
    } catch (error) {
      logger.error('Error in backrooms analysis validation:', error);
      return false;
    }
  }

  static contextQuery(query) {
    try {
      const { error } = contextQuerySchema.validate(query, { abortEarly: false });
      if (error) {
        logger.error('Context query validation failed:', {
          errors: error.details.map(d => d.message),
          query
        });
        return false;
      }
      return true;
    } catch (error) {
      logger.error('Error in context query validation:', error);
      return false;
    }
  }

  static validateObject(obj, schema, context = '') {
    try {
      const { error } = schema.validate(obj, { abortEarly: false });
      if (error) {
        logger.error(`${context} validation failed:`, {
          errors: error.details.map(d => d.message)
        });
        return false;
      }
      return true;
    } catch (error) {
      logger.error(`Error in ${context} validation:`, error);
      return false;
    }
  }
}

module.exports = {
  validate: Validator,
  schemas: {
    memory: memorySchema,
    backroomsAnalysis: backroomsAnalysisSchema,
    contextQuery: contextQuerySchema
  }
}; 