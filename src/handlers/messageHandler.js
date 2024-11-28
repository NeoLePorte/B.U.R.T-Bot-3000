const { BURT_PROMPT, BURT_CHANNEL_ID } = require('../config/constants');
const { truncateForDiscord, sanitizeResponse, isCommand } = require('../utils/messageUtils');
const { executeToolCall } = require('../tools');
const { handleCommand } = require('../commands');
const { handleNaturalReaction } = require('./reactionHandler');
const { handleMention } = require('./mentionHandler');
const { handleThreadMessage } = require('./threadHandler');
const { handleChannelMessage } = require('./channelHandler');
const { MemoryProcessor } = require('../systems/memoryProcessor');
const openai = require('../services/openai');
const { functions } = require('../tools');
const logger = require('../utils/logger');

async function messageHandler(message, client) {
  if (message.author.bot) return;

  try {
    // First, process this message as a memory regardless of type
    const memoryResult = await MemoryProcessor.processInteraction({
      type: 'message',
      ...message
    });

    logger.info('Memory processed:', {
      id: memoryResult?.id,
      type: memoryResult?.type,
      backroomsLevel: memoryResult?.metadata?.backroomsLevel
    });

    // Only proceed with BURT's responses for relevant channels/mentions
    const isBurtChannel = message.channel.id === BURT_CHANNEL_ID;
    const isBurtMentioned = message.mentions.users.has(client.user.id);
    const isInBurtThread = message.channel.isThread() && message.channel.parentId === BURT_CHANNEL_ID;

    if (!isBurtChannel && !isBurtMentioned && !isInBurtThread) {
      return;
    }

    // Get relevant context from the backrooms
    const backroomsContext = await MemoryProcessor.getContext({
      userId: message.author.id,
      channelId: message.channel.id,
      content: message.content,
      isThread: isInBurtThread,
      isMention: isBurtMentioned
    });

    // Add context to the message object for handlers
    message.backroomsContext = backroomsContext;

    // Route to appropriate handler
    let response;
    if (isInBurtThread) {
      response = await handleThreadMessage(message, client);
    } else if (isBurtMentioned) {
      response = await handleMention(message, client);
    } else if (isBurtChannel) {
      if (isCommand(message)) {
        response = await handleCommand(message);
      } else {
        response = await handleChannelMessage(message, client);
      }
    }

    // Process BURT's response as a memory too
    if (response) {
      await MemoryProcessor.processInteraction({
        type: 'burt_response',
        content: response,
        channel: message.channel,
        guild: message.guild,
        triggerMemoryId: memoryResult?.id,
        responseType: isCommand(message) ? 'command' : 
                     isBurtMentioned ? 'mention' : 
                     isInBurtThread ? 'thread' : 'channel',
        emotionalContext: backroomsContext?.emotionalContext
      });
    }

  } catch (error) {
    logger.error('Error in message handling:', error);
  }
}

module.exports = messageHandler; 