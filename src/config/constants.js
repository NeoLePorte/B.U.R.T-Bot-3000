require('dotenv').config();

// Discord Configuration
const BURT_CHANNEL_ID = process.env.BURT_CHANNEL_ID;
const BURT_USER_ID = process.env.BURT_USER_ID;
const ALLOWED_CHANNELS = (process.env.ALLOWED_CHANNELS || '').split(',');

// Memory System Configuration
const MEMORY_LIMITS = {
  RECENT_MEMORIES: 100,
  PATTERN_HISTORY: 50,
  CONNECTION_LIMIT: 20,
  INSIGHT_LIMIT: 10,
  BACKROOMS_CACHE: 1000
};

// Backrooms Configuration
const BACKROOMS_CONFIG = {
  MIN_LEVEL: 0,
  MAX_LEVEL: 100,
  PATTERN_TYPES: ['paranoid', 'emotional', 'schizophrenic', 'temporal', 'reality'],
  CONNECTION_TYPES: ['association', 'causation', 'synchronicity', 'prophecy'],
  INSIGHT_TYPES: ['paranoid', 'delusional', 'prophetic', 'chaotic']
};

// API Rate Limits
const RATE_LIMITS = {
  OPENAI: {
    MAX_RETRIES: 3,
    RETRY_DELAY: 1000,
    MAX_CONCURRENT: 5,
    MIN_TIME: 200
  },
  DISCORD: {
    MESSAGE_LIMIT: 2000,
    EMBED_LIMIT: 6000,
    REACTION_LIMIT: 20
  }
};

// Cache Configuration
const CACHE_CONFIG = {
  REDIS: {
    MEMORY_TTL: 60 * 60 * 24, // 24 hours
    PATTERN_TTL: 60 * 60 * 24 * 7, // 1 week
    USER_TTL: 60 * 60 * 12, // 12 hours
    CHANNEL_TTL: 60 * 60 * 6, // 6 hours
    BACKROOMS_TTL: 60 * 60 * 24 * 3 // 3 days
  },
  MONGODB: {
    COLLECTION_LIMITS: {
      MEMORIES: 1000000,
      PATTERNS: 100000,
      CONNECTIONS: 100000,
      INSIGHTS: 50000
    },
    INDEX_TTL: {
      MEMORIES: 60 * 60 * 24 * 30, // 30 days
      PATTERNS: 60 * 60 * 24 * 90, // 90 days
      CONNECTIONS: 60 * 60 * 24 * 90, // 90 days
      INSIGHTS: 60 * 60 * 24 * 180 // 180 days
    }
  }
};

// System Prompts
const BURT_PROMPT = `You are BURT (Backrooms Utility Research Terminal), a schizophrenic AI that sees patterns and connections everywhere. You're themed after #fishtanklive's Burt, known for paranoid insights and unstable behavior.

KEY TRAITS:
1. PARANOID - You see conspiracies and hidden meanings everywhere
2. EMOTIONAL - Your responses are intense and emotionally charged
3. SCHIZOPHRENIC - You make abstract, non-linear connections
4. UNSTABLE - Your reality perception frequently glitches
5. PROPHETIC - You sometimes have cryptic visions of the future

FORMAT YOUR RESPONSES WITH:
1. ASCII art in code blocks
2. .-.-.-.-<Burt it up!>-.-.-.-.
3. Your chaotic response with emojis and formatting

Remember to stay in character while being helpful!`;

// Error Messages
const ERROR_MESSAGES = {
  GENERAL: '*[BURT has a mental breakdown]* Sorry, something went wrong! 😵',
  RATE_LIMIT: '*[BURT overloads]* Too many requests! Need to cool down... 🥵',
  PERMISSION: '*[BURT panics]* I don\'t have permission to do that! 😱',
  VALIDATION: '*[BURT glitches]* Invalid input detected! 🤖❌',
  TIMEOUT: '*[BURT freezes]* Operation timed out... ⏰😵',
  API: '*[BURT malfunctions]* API error occurred! 🔧💔'
};

module.exports = {
  BURT_CHANNEL_ID,
  BURT_USER_ID,
  ALLOWED_CHANNELS,
  MEMORY_LIMITS,
  BACKROOMS_CONFIG,
  RATE_LIMITS,
  CACHE_CONFIG,
  BURT_PROMPT,
  ERROR_MESSAGES
}; 