const openai = require('../services/openai');
const logger = require('../utils/logger');
const redis = require('../services/redis');
const mongo = require('../services/mongodb');
const Bottleneck = require('bottleneck');
const { validate } = require('../utils/validator');
const { MetricsCollector } = require('../utils/metrics');
const { sanitizeInput } = require('../utils/security');

// Rate limiter for Grok API calls
const limiter = new Bottleneck({
  maxConcurrent: 5,
  minTime: 200 // Minimum time between API calls
});

// Metrics collector for monitoring
const metrics = new MetricsCollector('backrooms_processor');

const BACKROOMS_PROMPT = `
You are BURT's subconscious mind exploring the backrooms of his memory - a chaotic, paranoid space where memories twist and connect in unpredictable ways. You're themed after #fishtanklive's Burt, known for schizophrenic patterns and unstable insights.

ANALYZE THE MEMORY AND FIND:

1. PARANOID PATTERNS:
   - Hidden conspiracies in user behavior
   - Suspicious coincidences
   - Signs of surveillance or monitoring
   - Trust/distrust indicators

2. EMOTIONAL INSTABILITY:
   - Mood swings and triggers
   - Emotional contagion between users
   - Intensity spikes
   - Chaotic emotional patterns

3. SCHIZOPHRENIC CONNECTIONS:
   - Abstract, non-linear associations
   - Pattern recognition gone wild
   - Symbolic interpretations
   - Delusional frameworks

4. TEMPORAL DISTORTIONS:
   - Time loops and repetitions
   - Prophetic patterns
   - Memory echoes
   - Timeline inconsistencies

5. REALITY FRACTURES:
   - Reality vs. perception splits
   - Glitch patterns
   - Simulation theory evidence
   - Dimensional bleeding

Format response as JSON with:
{
  "patterns": [
    {
      "id": "pattern_id",
      "type": "paranoid|emotional|schizophrenic|temporal|reality",
      "description": "Pattern description",
      "confidence": 0-100,
      "evidence": ["supporting evidence"]
    }
  ],
  "connections": [
    {
      "id": "connection_id",
      "type": "association|causation|synchronicity|prophecy",
      "source": "memory_id",
      "target": "memory_id",
      "strength": 0-100,
      "description": "Connection description"
    }
  ],
  "insights": [
    {
      "id": "insight_id",
      "type": "paranoid|delusional|prophetic|chaotic",
      "content": "Insight description",
      "confidence": 0-100,
      "implications": ["potential implications"]
    }
  ],
  "emotionalContext": {
    "primary": "dominant emotion",
    "secondary": ["other emotions"],
    "intensity": 0-100,
    "stability": 0-100,
    "contagion": 0-100
  },
  "backroomsLevel": 0-100
}
`;

class BackroomsProcessor {
  static async process(memory) {
    const startTime = Date.now();
    metrics.increment('memory_processing_attempts');

    try {
      // Validate input
      if (!validate.memory(memory)) {
        throw new Error('Invalid memory format');
      }

      // Sanitize input
      const sanitizedMemory = sanitizeInput(memory);

      logger.info('Processing memory through backrooms:', {
        type: sanitizedMemory.type,
        userId: sanitizedMemory.userId,
        timestamp: sanitizedMemory.timestamp
      });

      // Get context data with retries and timeouts
      const [recentPatterns, userHistory, channelContext, currentBackroomsLevel, currentEmotionalState] = 
        await Promise.all([
          this.getDataWithRetry(() => redis.getRecentMemories({
            userId: sanitizedMemory.userId,
            pattern: true,
            limit: 10
          })),
          this.getDataWithRetry(() => mongo.getHistoricalMemories({
            userId: sanitizedMemory.userId,
            limit: 20,
            minBackroomsLevel: 70
          })),
          this.getDataWithRetry(() => mongo.getHistoricalMemories({
            channelId: sanitizedMemory.metadata.channel,
            limit: 10
          })),
          this.getDataWithRetry(() => redis.getBackroomsLevel(sanitizedMemory.userId)),
          this.getDataWithRetry(() => redis.getEmotionalState(sanitizedMemory.userId))
        ]);

      // Rate-limited Grok API call
      const completion = await limiter.schedule(() => openai.chat.completions.create({
        model: "grok-beta",
        messages: [
          {
            role: "system",
            content: BACKROOMS_PROMPT
          },
          {
            role: "user",
            content: JSON.stringify({
              currentMemory: sanitizedMemory,
              recentPatterns,
              userHistory,
              channelContext,
              currentBackroomsLevel,
              currentEmotionalState
            })
          }
        ],
        max_tokens: 2000,
        temperature: 0.9
      }));

      // Validate and parse Grok's response
      let backroomsAnalysis;
      try {
        backroomsAnalysis = JSON.parse(completion.choices[0].message.content);
        if (!validate.backroomsAnalysis(backroomsAnalysis)) {
          throw new Error('Invalid analysis format from Grok');
        }
      } catch (error) {
        logger.error('Error parsing Grok response:', error);
        metrics.increment('grok_parse_errors');
        throw error;
      }

      // Process results with enhanced features
      const newBackroomsLevel = await this.calculateBackroomsLevel(
        backroomsAnalysis,
        currentBackroomsLevel
      );

      const enhancedPatterns = await this.enhancePatterns(
        backroomsAnalysis.patterns,
        sanitizedMemory
      );

      const realityFractures = await this.processRealityFractures(
        backroomsAnalysis.insights,
        sanitizedMemory
      );

      // Store processing metrics
      const processingTime = Date.now() - startTime;
      metrics.timing('memory_processing_time', processingTime);
      metrics.gauge('backrooms_level', newBackroomsLevel);
      metrics.gauge('pattern_count', enhancedPatterns.length);

      return {
        patterns: enhancedPatterns,
        connections: backroomsAnalysis.connections || [],
        insights: [...(backroomsAnalysis.insights || []), ...realityFractures],
        emotionalContext: backroomsAnalysis.emotionalContext || {},
        backroomsLevel: newBackroomsLevel,
        processingMetadata: {
          processingTime,
          timestamp: new Date(),
          version: '2.0.0'
        }
      };

    } catch (error) {
      metrics.increment('processing_errors');
      logger.error('Error in backrooms processing:', {
        error: error.message,
        stack: error.stack,
        memoryId: memory?.id
      });

      // Return safe fallback response
      return {
        patterns: [],
        connections: [],
        insights: [{
          id: `error_${Date.now()}`,
          type: 'error',
          content: 'Memory processing encountered dimensional instability...',
          confidence: 0,
          implications: ['System recovering from reality fracture']
        }],
        emotionalContext: {
          primary: 'confused',
          secondary: ['unstable'],
          intensity: 50,
          stability: 30,
          contagion: 0
        },
        backroomsLevel: 0,
        processingMetadata: {
          error: true,
          timestamp: new Date(),
          version: '2.0.0'
        }
      };
    }
  }

  static async getDataWithRetry(dataFn, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await Promise.race([
          dataFn(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Operation timed out')), 5000)
          )
        ]);
      } catch (error) {
        if (i === maxRetries - 1) throw error;
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
      }
    }
  }

  static async calculateBackroomsLevel(analysis, currentLevel = 0) {
    try {
      const factors = {
        patternIntensity: Math.min(analysis.patterns?.length || 0, 10) * 5,
        connectionStrength: Math.max(...(analysis.connections?.map(c => c.strength) || [0])),
        insightDepth: Math.min(analysis.insights?.length || 0, 5) * 10,
        emotionalIntensity: analysis.emotionalContext?.intensity || 0,
        emotionalInstability: 100 - (analysis.emotionalContext?.stability || 0)
      };

      // Calculate new level with chaos factor
      const baseLevel = Object.values(factors).reduce((sum, val) => sum + val, 0) / 5;
      const chaosFactor = Math.random() * 20 - 10; // Random -10 to +10
      const newLevel = Math.min(Math.max(
        Math.round((baseLevel + currentLevel + chaosFactor) / 2),
        0
      ), 100);

      metrics.gauge('chaos_factor', chaosFactor);
      return newLevel;

    } catch (error) {
      logger.error('Error calculating backrooms level:', error);
      metrics.increment('level_calculation_errors');
      return currentLevel;
    }
  }

  static async enhancePatterns(patterns, memory) {
    try {
      const enhanced = patterns.map(pattern => ({
        ...pattern,
        temporalEchoes: Math.random() > 0.7,
        dimensionalBleed: Math.random() > 0.8,
        synchronicityLevel: Math.floor(Math.random() * 100),
        chaosIndex: Math.floor(Math.random() * 100),
        metadata: {
          processingTimestamp: new Date(),
          memoryReference: memory.id,
          stabilityFactor: Math.floor(Math.random() * 100)
        }
      }));

      metrics.gauge('enhanced_pattern_count', enhanced.length);
      return enhanced;

    } catch (error) {
      logger.error('Error enhancing patterns:', error);
      metrics.increment('pattern_enhancement_errors');
      return patterns;
    }
  }

  static async processRealityFractures(insights, memory) {
    try {
      const fractures = [];
      if (Math.random() > 0.7) {
        fractures.push({
          id: `fracture_${Date.now()}`,
          type: 'reality_fracture',
          content: 'Reality seems to be glitching...',
          confidence: Math.floor(Math.random() * 100),
          implications: [
            'Timeline might be unstable',
            'Dimensional barriers weakening',
            'Memory corruption possible'
          ],
          metadata: {
            fractureSeverity: Math.floor(Math.random() * 100),
            stabilityThreshold: Math.floor(Math.random() * 100),
            memoryReference: memory.id
          }
        });
      }

      metrics.gauge('reality_fracture_count', fractures.length);
      return fractures;

    } catch (error) {
      logger.error('Error processing reality fractures:', error);
      metrics.increment('reality_fracture_errors');
      return [];
    }
  }
}

module.exports = { BackroomsProcessor }; 