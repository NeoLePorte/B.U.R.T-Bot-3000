const { BURT_PROMPT, BURT_CHANNEL_ID } = require('../config/constants');
const { truncateForDiscord, sanitizeResponse, isCommand } = require('../utils/messageUtils');
const { executeToolCall } = require('../tools');
const { handleCommand } = require('../commands');
const { handleNaturalReaction } = require('./reactionHandler');
const { handleMention } = require('./mentionHandler');
const openai = require('../services/openai');
const { functions } = require('../tools');
const logger = require('../utils/logger');
const { getImageContext } = require('../tools/messageTools');

async function messageHandler(message, client) {
  if (message.author.bot) return;

  const isBurtChannel = message.channel.id === BURT_CHANNEL_ID;
  const isBurtMentioned = message.mentions.users.has(client.user.id);
  const isInBurtThread = message.channel.isThread() && message.channel.parentId === BURT_CHANNEL_ID;

  if (!isBurtChannel && !isBurtMentioned && !isInBurtThread) {
    return;
  }

  logger.info('=== BURT MESSAGE PROCESSING START ===');
  logger.info({
    content: message.content,
    author: message.author.username,
    channel: message.channel.name,
    guild: message.guild?.name,
    type: isBurtMentioned ? 'mention' : isBurtChannel ? 'channel' : 'thread'
  });

  try {
    if (isInBurtThread) {
      await handleThreadMessage(message, client);
      return;
    }

    if (isBurtMentioned) {
      await handleMention(message, client);
      return;
    }

    if (isBurtChannel) {
      if (isCommand(message)) {
        logger.info('Processing command...');
        await handleCommand(message);
      } else {
        const loadingMessage = await message.reply('*[BURT twitches and starts thinking...]* 🤪');
        
        try {
          logger.info('1. Checking for images...');
          const imageContexts = await getImageContext(message);
          if (imageContexts?.length > 0) {
            logger.info(`Found ${imageContexts.length} images in message`);
          }

          logger.info('2. Making initial API call to Grok...');
          const completion = await openai.chat.completions.create({
            model: "grok-beta",
            messages: [
              { 
                role: "system", 
                content: BURT_PROMPT + "\n[IMPORTANT: Format your response exactly like this:\n1. ```ascii\n[Your creative ASCII art here]\n```\n2. .-.-.-.-<Burt it up!>-.-.-.-.\n3. Your chaotic response with emojis and formatting]" 
              },
              { 
                role: "user", 
                content: `[Context: Message from user in BURT channel: ${message.author.username}]\n${message.content}` +
                  (imageContexts?.length > 0 ? '\n[Images are attached to this message. Use the analyze_image tool to see them.]' : '')
              }
            ],
            max_tokens: 1000,
            tools: functions,
            tool_choice: "auto"
          });

          let response = completion.choices[0].message;
          logger.info('3. Initial response received:', {
            hasContent: !!response.content,
            contentPreview: response.content?.substring(0, 100) + '...',
            hasToolCalls: !!response.tool_calls,
            numToolCalls: response.tool_calls?.length || 0
          });

          const toolResults = [];
          if (response.tool_calls) {
            logger.info('4. Processing tool calls...');
            for (const toolCall of response.tool_calls) {
              logger.info(`  - Executing tool: ${toolCall.function.name}`);
              logger.debug(`    Arguments: ${toolCall.function.arguments}`);
              try {
                let args = JSON.parse(toolCall.function.arguments);
                if (toolCall.function.name === 'analyze_image' && imageContexts) {
                  args.images = imageContexts.map(img => ({
                    type: "image",
                    source: {
                      type: "base64",
                      data: img
                    }
                  }));
                }
                const result = await executeToolCall(toolCall.function.name, args, message);
                logger.info(`  - Tool execution successful`);
                logger.debug(`    Result: ${JSON.stringify(result).substring(0, 100)}...`);
                toolResults.push({
                  tool_call_id: toolCall.id,
                  role: "tool",
                  content: JSON.stringify(result)
                });
              } catch (error) {
                logger.error(`  - Tool execution failed for ${toolCall.function.name}:`, error);
                toolResults.push({
                  tool_call_id: toolCall.id,
                  role: "tool",
                  content: JSON.stringify({ error: true, message: error.message })
                });
              }
            }
          }

          if (toolResults.length > 0) {
            logger.info('5. Getting final response with tool results...');
            const messages = [
              { 
                role: "system", 
                content: BURT_PROMPT + "\n[IMPORTANT: Format your response exactly like this:\n1. ```ascii\n[Your creative ASCII art here]\n```\n2. .-.-.-.-<Burt it up!>-.-.-.-.\n3. Your chaotic response with emojis and formatting]" 
              },
              { 
                role: "user", 
                content: `[Context: Message from user in BURT channel: ${message.author.username}]\n${message.content}` 
              },
              response,
              ...toolResults
            ];
            
            const nextCompletion = await openai.chat.completions.create({
              model: "grok-beta",
              messages: messages,
              max_tokens: 1000
            });

            response = nextCompletion.choices[0].message;
            logger.info('6. Final response received');
            logger.debug('Final response content:', response.content?.substring(0, 100) + '...');
          }

          const sanitizedContent = sanitizeResponse(response.content || 'No response');
          await loadingMessage.edit(truncateForDiscord(sanitizedContent));
          logger.info('=== BURT MESSAGE PROCESSING COMPLETE ===');
        } catch (error) {
          logger.error('Error processing channel message:', error);
          await loadingMessage.edit('*[BURT has a mental breakdown]* Sorry, something went wrong! 😵');
        }
      }
    }
  } catch (error) {
    logger.error('Error in message handling:', error);
  }
}

module.exports = messageHandler; 