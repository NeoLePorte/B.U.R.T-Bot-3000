const { BURT_CHANNEL_ID } = require('../config/constants');
const openai = require('../services/openai');
const { getImageContext } = require('../tools/messageTools');
const { handleGalleryNavigation } = require('../commands/images');
const reactionTool = require('../tools/reactions');
const { ContextManager } = require('../systems/contextManager');
const { MemoryProcessor } = require('../systems/memoryProcessor');
const { BackroomsProcessor } = require('../systems/backroomsProcessor');

async function handleReactionAdd(reaction, user) {
  if (user.bot) return;
  
  // Handle gallery navigation via the images command module
  if (reaction.message.author.bot && reaction.message.embeds.length > 0) {
    await handleGalleryNavigation(reaction, user);
    return;
  }

  // BURT's reaction behavior
  if (reaction.message.channel.id === BURT_CHANNEL_ID) {
    try {
      // Get message context including any images
      const imageContexts = await getImageContext(reaction.message);
      
      // Store this reaction as a memory
      const memory = {
        type: 'reaction',
        content: `User ${user.username} reacted with ${reaction.emoji.name}`,
        userId: user.id,
        timestamp: new Date(),
        metadata: {
          channel: reaction.message.channel.id,
          messageContent: reaction.message.content,
          reactionEmoji: reaction.emoji.name,
          hasImages: !!imageContexts
        }
      };
      
      // Process and store the memory
      await MemoryProcessor.processMemory(memory);
      
      // Get relevant backrooms context
      const backroomsContext = await ContextManager.getRelevantContext({
        userId: user.id,
        channelId: reaction.message.channel.id,
        content: reaction.message.content,
        reactionEmoji: reaction.emoji.name
      });

      // Build the full context for Grok
      const messageContext = {
        currentInteraction: `User ${user.username} reacted with ${reaction.emoji.name} to message: "${reaction.message.content}"`,
        backroomsInsights: backroomsContext.insights,
        emotionalPatterns: backroomsContext.emotionalContext,
        connectionPatterns: backroomsContext.connections,
        backroomsLevel: backroomsContext.backroomsLevel
      };
      
      // Get BURT's reaction response using Grok with backrooms context
      const completion = await openai.chat.completions.create({
        model: "grok-beta",
        messages: [
          {
            role: "system",
            content: "You are BURT, a chaotic and paranoid Discord bot themed after #fishtanklive's Burt. Your responses are influenced by your backrooms memory system - a dreamlike space where memories and patterns connect in abstract ways. Your reactions should reflect both your unstable personality and the patterns emerging from your backrooms. Choose whether to react back, and if so, with what emoji. Respond with just the emoji or 'none'."
          },
          {
            role: "user",
            content: JSON.stringify(messageContext)
          }
        ],
        max_tokens: 10
      });

      const responseEmoji = completion.choices[0].message.content.trim();
      
      // React if BURT chose an emoji using the reaction tool
      if (responseEmoji && responseEmoji !== 'none') {
        await reactionTool.execute({
          emoji: responseEmoji,
          messageId: reaction.message.id,
          channelId: reaction.message.channel.id
        }, reaction.message, reaction.client);

        // Store BURT's reaction as a memory too
        const responseMemory = {
          type: 'burt_reaction',
          content: `BURT reacted with ${responseEmoji}`,
          userId: 'BURT',
          timestamp: new Date(),
          metadata: {
            channel: reaction.message.channel.id,
            triggerMemoryId: memory.id,
            reactionEmoji: responseEmoji,
            backroomsLevel: backroomsContext.backroomsLevel
          }
        };
        await MemoryProcessor.processMemory(responseMemory);
      }
    } catch (error) {
      console.error('Error handling reaction:', error);
    }
  }
}

async function handleNaturalReaction(message) {
  const delay = Math.floor(Math.random() * 1500) + 500;
  await new Promise(resolve => setTimeout(resolve, delay));
  
  try {
    const imageContexts = await getImageContext(message);
    
    // Store the message as a memory
    const memory = {
      type: 'message',
      content: message.content,
      userId: message.author.id,
      timestamp: new Date(),
      metadata: {
        channel: message.channel.id,
        hasImages: !!imageContexts
      }
    };
    await MemoryProcessor.processMemory(memory);

    // Get backrooms context
    const backroomsContext = await ContextManager.getRelevantContext({
      userId: message.author.id,
      channelId: message.channel.id,
      content: message.content
    });

    // Build full context for Grok
    const messageContext = {
      currentMessage: `Message from user ${message.author.username}: "${message.content}"`,
      backroomsInsights: backroomsContext.insights,
      emotionalPatterns: backroomsContext.emotionalContext,
      connectionPatterns: backroomsContext.connections,
      backroomsLevel: backroomsContext.backroomsLevel
    };
    
    const completion = await openai.chat.completions.create({
      model: "grok-beta",
      messages: [
        {
          role: "system",
          content: "You are BURT, a chaotic and paranoid Discord bot themed after #fishtanklive's Burt. Your responses are influenced by your backrooms memory system - a dreamlike space where memories and patterns connect in abstract ways. Choose an emoji that reflects both your unstable personality and the patterns emerging from your backrooms. Respond with just the emoji or 'none'."
        },
        {
          role: "user",
          content: JSON.stringify(messageContext)
        }
      ],
      max_tokens: 10
    });

    const emoji = completion.choices[0].message.content.trim();
    if (emoji && emoji !== 'none') {
      await reactionTool.execute({
        emoji: emoji,
        messageId: message.id,
        channelId: message.channel.id
      }, message, message.client);

      // Store BURT's reaction as a memory
      const responseMemory = {
        type: 'burt_reaction',
        content: `BURT reacted with ${emoji}`,
        userId: 'BURT',
        timestamp: new Date(),
        metadata: {
          channel: message.channel.id,
          triggerMemoryId: memory.id,
          reactionEmoji: emoji,
          backroomsLevel: backroomsContext.backroomsLevel
        }
      };
      await MemoryProcessor.processMemory(responseMemory);
    }
  } catch (error) {
    console.error('Error adding natural reaction:', error);
  }
}

module.exports = {
  handleReactionAdd,
  handleNaturalReaction
}; 