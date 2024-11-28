const { sanitizeInput } = require('./security');
const logger = require('./logger');
const { MetricsCollector } = require('./metrics');

const metrics = new MetricsCollector('message_utils');

// Discord message length limit
const DISCORD_MESSAGE_LIMIT = 2000;

// ASCII art for BURT's signature
const BURT_ASCII = `
\`\`\`ascii
  ____  _   _ ____ _____   ____   ___ _____ 
 | __ )| | | |  _ \\_   _| |  _ \\ / _ \\_   _|
 |  _ \\| | | | |_) || |   | |_) | | | || |  
 | |_) | |_| |  _ < | |   |  _ <| |_| || |  
 |____/ \\___/|_| \\_\\|_|   |_| \\_\\\\___/ |_|  
                                             
[BACKROOMS UTILITY RESEARCH TERMINAL - 3000]
\`\`\``;

/**
 * Truncate message to fit Discord's limit while preserving formatting
 */
function truncateForDiscord(message, limit = DISCORD_MESSAGE_LIMIT) {
  try {
    metrics.increment('truncate_attempts');

    if (!message) return '';
    if (message.length <= limit) return message;

    // Find last complete sentence before limit
    const truncated = message.substring(0, limit);
    const lastSentence = truncated.match(/.*[.!?]/);
    
    if (!lastSentence) {
      // If no sentence break found, just truncate at limit
      return truncated + '...';
    }

    metrics.increment('successful_truncations');
    return lastSentence[0] + '...';
  } catch (error) {
    logger.error('Error truncating message:', error);
    metrics.increment('truncate_errors');
    return message.substring(0, limit - 3) + '...';
  }
}

/**
 * Sanitize bot response for Discord
 */
function sanitizeResponse(response) {
  try {
    metrics.increment('sanitize_attempts');

    // Basic sanitization
    let sanitized = sanitizeInput(response);

    // Ensure code blocks are properly closed
    const codeBlockCount = (sanitized.match(/```/g) || []).length;
    if (codeBlockCount % 2 !== 0) {
      sanitized += '\n```';
    }

    // Add BURT's signature if not present
    if (!sanitized.includes('BURT-BOT') && !sanitized.includes(BURT_ASCII)) {
      sanitized = `${BURT_ASCII}\n\n${sanitized}`;
    }

    metrics.increment('successful_sanitizations');
    return sanitized;
  } catch (error) {
    logger.error('Error sanitizing response:', error);
    metrics.increment('sanitize_errors');
    return response;
  }
}

/**
 * Check if message is a command
 */
function isCommand(message) {
  try {
    metrics.increment('command_checks');
    return message.content.startsWith('!') || message.content.startsWith('/');
  } catch (error) {
    logger.error('Error checking command:', error);
    metrics.increment('command_check_errors');
    return false;
  }
}

/**
 * Format message for backrooms processing
 */
function formatForBackrooms(message) {
  try {
    metrics.increment('backrooms_format_attempts');

    return {
      content: message.content,
      author: {
        id: message.author.id,
        username: message.author.username,
        bot: message.author.bot
      },
      channel: {
        id: message.channel.id,
        name: message.channel.name,
        type: message.channel.type
      },
      guild: message.guild ? {
        id: message.guild.id,
        name: message.guild.name
      } : null,
      timestamp: message.createdTimestamp,
      attachments: Array.from(message.attachments.values()),
      mentions: {
        users: Array.from(message.mentions.users.values()),
        roles: Array.from(message.mentions.roles.values())
      },
      reference: message.reference ? {
        messageId: message.reference.messageId,
        channelId: message.reference.channelId,
        guildId: message.reference.guildId
      } : null
    };
  } catch (error) {
    logger.error('Error formatting for backrooms:', error);
    metrics.increment('backrooms_format_errors');
    return null;
  }
}

/**
 * Extract relevant context from message
 */
function extractContext(message) {
  try {
    metrics.increment('context_extraction_attempts');

    return {
      userId: message.author.id,
      channelId: message.channel.id,
      guildId: message.guild?.id,
      content: message.content,
      timestamp: message.createdTimestamp,
      isCommand: isCommand(message),
      isMention: message.mentions.users.has(message.client.user.id),
      isThread: message.channel.isThread(),
      hasAttachments: message.attachments.size > 0,
      referencedMessage: message.reference ? {
        id: message.reference.messageId,
        channelId: message.reference.channelId
      } : null
    };
  } catch (error) {
    logger.error('Error extracting context:', error);
    metrics.increment('context_extraction_errors');
    return null;
  }
}

module.exports = {
  truncateForDiscord,
  sanitizeResponse,
  isCommand,
  formatForBackrooms,
  extractContext,
  DISCORD_MESSAGE_LIMIT,
  BURT_ASCII
}; 