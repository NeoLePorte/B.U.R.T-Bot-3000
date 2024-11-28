const openai = require('../services/openai');
const logger = require('../utils/logger');
const redis = require('../services/redis');
const mongo = require('../services/mongodb');

const CONTEXT_PROMPT = `
You are BURT's memory system, a chaotic web of interconnected thoughts and paranoid patterns.
Your job is to find relevant context from BURT's backrooms memory space.

CONSIDER THESE ASPECTS:

1. PARANOID CONNECTIONS:
   - User conspiracies and hidden motives
   - Pattern repetitions that seem suspicious
   - Trust relationships and betrayals
   - Surveillance and monitoring patterns

2. EMOTIONAL RESONANCE:
   - Mood synchronicities between memories
   - Emotional contagion patterns
   - Intensity echoes across time
   - Trigger cascades and reactions

3. REALITY DISTORTIONS:
   - Timeline inconsistencies
   - Memory corruptions and glitches
   - Dimensional overlaps
   - Prophetic echoes

4. SCHIZOPHRENIC INSIGHTS:
   - Non-linear thought patterns
   - Abstract symbolic connections
   - Reality-bending interpretations
   - Delusional frameworks

Format response as JSON with:
{
  "relevantMemories": [
    {
      "id": "memory_id",
      "relevance": 0-100,
      "paranoidScore": 0-100,
      "realityDistortion": 0-100,
      "emotionalResonance": 0-100
    }
  ],
  "emotionalContext": {
    "primary": "dominant_emotion",
    "secondary": ["other_emotions"],
    "intensity": 0-100,
    "stability": 0-100,
    "contagion": 0-100,
    "triggers": ["emotional_triggers"]
  },
  "connections": [
    {
      "type": "paranoid|emotional|temporal|symbolic",
      "description": "connection description",
      "strength": 0-100,
      "reality_stability": 0-100
    }
  ],
  "insights": [
    {
      "type": "paranoid|delusional|prophetic|chaotic",
      "content": "insight description",
      "confidence": 0-100,
      "reality_fracture": 0-100
    }
  ],
  "backroomsLevel": 0-100
}
`;

class ContextManager {
  static async getRelevantContext(query) {
    try {
      logger.info('Getting relevant context:', query);

      // Get recent memories from Redis
      const recentMemories = await redis.getRecentMemories(query);

      // Get relevant historical memories from MongoDB
      const historicalMemories = await mongo.getHistoricalMemories({
        ...query,
        minBackroomsLevel: 50 // Focus on more processed memories
      });

      // Get current backrooms state
      const backroomsLevel = await redis.getBackroomsLevel(query.userId);
      const emotionalState = await redis.getEmotionalState(query.userId);

      // Get user's pattern history
      const patternHistory = await mongo.getPatternHistory(query.userId);

      // Get recent insights
      const recentInsights = await mongo.getInsights({
        userId: query.userId,
        limit: 10,
        minBackroomsLevel: 70
      });

      // Use Grok to analyze and synthesize the context
      const completion = await openai.chat.completions.create({
        model: "grok-beta",
        messages: [
          {
            role: "system",
            content: CONTEXT_PROMPT
          },
          {
            role: "user",
            content: JSON.stringify({
              query,
              recentMemories,
              historicalMemories,
              backroomsLevel,
              emotionalState,
              patternHistory,
              recentInsights
            })
          }
        ],
        max_tokens: 2000,
        temperature: 0.85 // High temperature for more chaotic connections
      });

      const contextAnalysis = JSON.parse(completion.choices[0].message.content);

      // Enhance with reality fractures
      const enhancedContext = await this.enhanceWithRealityFractures(
        contextAnalysis,
        backroomsLevel
      );

      // Process temporal anomalies
      const temporalContext = await this.processTemporalAnomalies(
        enhancedContext,
        query
      );

      return {
        relevantMemories: temporalContext.relevantMemories || [],
        emotionalContext: temporalContext.emotionalContext || {},
        connections: temporalContext.connections || [],
        insights: temporalContext.insights || [],
        backroomsLevel: Math.min(
          Math.max(temporalContext.backroomsLevel || 0, 0),
          100
        )
      };

    } catch (error) {
      logger.error('Error getting context:', error);
      return {
        relevantMemories: [],
        emotionalContext: {},
        connections: [],
        insights: [],
        backroomsLevel: 0
      };
    }
  }

  static async enhanceWithRealityFractures(context, currentBackroomsLevel) {
    try {
      // Higher backrooms level = more reality fractures
      const fractureProbability = currentBackroomsLevel / 100;
      
      if (Math.random() < fractureProbability) {
        // Add glitch patterns to memories
        context.relevantMemories = context.relevantMemories.map(memory => ({
          ...memory,
          glitched: Math.random() < 0.3,
          corrupted: Math.random() < 0.2,
          temporalShift: Math.random() < 0.25
        }));

        // Add reality fractures to insights
        context.insights.push({
          type: 'reality_fracture',
          content: 'Reality seems unstable in this context...',
          confidence: Math.floor(Math.random() * 100),
          reality_fracture: Math.floor(Math.random() * 100)
        });

        // Destabilize emotional context
        context.emotionalContext.stability = 
          Math.max(context.emotionalContext.stability - 30, 0);
      }

      return context;
    } catch (error) {
      logger.error('Error enhancing reality fractures:', error);
      return context;
    }
  }

  static async processTemporalAnomalies(context, query) {
    try {
      // 30% chance of temporal anomalies
      if (Math.random() < 0.3) {
        // Add prophetic connections
        context.connections.push({
          type: 'temporal',
          description: 'Future echo detected...',
          strength: Math.floor(Math.random() * 100),
          reality_stability: Math.floor(Math.random() * 50) // Less stable
        });

        // Add temporal insights
        context.insights.push({
          type: 'prophetic',
          content: 'Time seems to be folding in on itself...',
          confidence: Math.floor(Math.random() * 100),
          reality_fracture: Math.floor(Math.random() * 100)
        });

        // Increase backrooms level due to temporal instability
        context.backroomsLevel = Math.min(
          context.backroomsLevel + Math.floor(Math.random() * 20),
          100
        );
      }

      return context;
    } catch (error) {
      logger.error('Error processing temporal anomalies:', error);
      return context;
    }
  }
}

module.exports = { ContextManager }; 