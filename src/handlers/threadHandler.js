const { BURT_PROMPT, BURT_CHANNEL_ID } = require('../config/constants');
const { truncateForDiscord, sanitizeResponse } = require('../utils/messageUtils');
const { aiRateLimiter } = require('../utils/rateLimit');
const { executeToolCall } = require('../tools');
const openai = require('../services/openai');
const { functions } = require('../tools');
const logger = require('../utils/logger');
const { getImageContext, getRecentMessages } = require('../tools/messageTools');

async function handleThreadMessage(message, client) {
  if (!message.channel.isThread() || message.channel.parentId !== BURT_CHANNEL_ID) {
    return;
  }

  if (!aiRateLimiter.tryRequest(message.author.id)) {
    await message.reply("Whoa there! Slow down, I'm still processing your last request! 🤯");
    return;
  }

  const loadingMessage = await message.reply('*[BURT twitches and starts thinking...]* 🤪');

  try {
    logger.info('=== BURT THREAD PROCESSING START ===');
    logger.info(`User: ${message.author.username}`);
    logger.info(`Thread: ${message.channel.name}`);
    
    // Fetch and process thread context
    const threadMessages = await message.channel.messages.fetch({ limit: 5 });
    const processedMessages = await Promise.all(
      Array.from(threadMessages.values()).map(async msg => {
        const imageContexts = await getImageContext(msg);
        return {
          content: msg.content,
          author: msg.author.username,
          images: imageContexts || []
        };
      })
    );

    const contextMessages = processedMessages
      .reverse()
      .map(msg => {
        let messageText = `${msg.author}: ${msg.content}`;
        if (msg.images?.length > 0) {
          messageText += ' [Images are attached to this message. Use the analyze_image tool to see them.]';
        }
        return messageText;
      })
      .join('\n');

    logger.info('Thread context processed:', { 
      messageCount: processedMessages.length,
      hasImages: processedMessages.some(msg => msg.images.length > 0)
    });

    const completion = await openai.chat.completions.create({
      model: "grok-beta",
      messages: [
        { 
          role: "system", 
          content: BURT_PROMPT + "\n[IMPORTANT: Format your response exactly like this:\n1. ASCII art in code blocks\n2. .-.-.-.-<Burt it up!>-.-.-.-.\n3. Your chaotic response]" 
        },
        { 
          role: "user", 
          content: `[Context: Thread history:\n${contextMessages}\n\nMessage from user: ${message.author.username}]\n${message.content}`
        }
      ],
      max_tokens: 1000,
      tools: functions,
      tool_choice: "auto"
    });

    let response = completion.choices[0].message;
    const toolResults = [];

    if (response.tool_calls) {
      logger.debug('Processing tool calls:', response.tool_calls);
      
      for (const toolCall of response.tool_calls) {
        try {
          let args = JSON.parse(toolCall.function.arguments);
          if (toolCall.function.name === 'analyze_image' && currentImageContexts) {
            args.images = currentImageContexts.map(img => ({
              type: "image",
              source: {
                type: "base64",
                data: img
              }
            }));
          }
          const result = await executeToolCall(toolCall.function.name, args, message);
          toolResults.push({
            tool_call_id: toolCall.id,
            role: "tool",
            content: JSON.stringify(result)
          });
        } catch (error) {
          logger.error('Tool execution failed:', error);
          toolResults.push({
            tool_call_id: toolCall.id,
            role: "tool",
            content: JSON.stringify({ error: true, message: error.message })
          });
        }
      }

      if (toolResults.length > 0) {
        const messages = [
          { role: "system", content: BURT_PROMPT },
          { role: "user", content: `[Context: Thread history:\n${contextMessages}\n\nMessage from user: ${message.author.username}]\n${message.content}` },
          response,
          ...toolResults
        ];
        
        const nextCompletion = await openai.chat.completions.create({
          model: "grok-beta",
          messages: messages,
          max_tokens: 1000
        });

        response = nextCompletion.choices[0].message;
      }
    }

    const sanitizedContent = sanitizeResponse(response.content || 'No response');
    await loadingMessage.edit(truncateForDiscord(sanitizedContent));

  } catch (error) {
    logger.error('Error in thread handling:', error);
    await loadingMessage.edit('*[BURT has a mental breakdown]* Sorry, something went wrong! 😵');
  }
}

module.exports = { handleThreadMessage }; 