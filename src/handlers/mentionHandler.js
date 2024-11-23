const { BURT_PROMPT } = require('../config/constants');
const { executeToolCall } = require('../tools');
const { truncateForDiscord, sanitizeResponse } = require('../utils/messageUtils');
const openai = require('../services/openai');
const { functions } = require('../tools');
const logger = require('../utils/logger');
const { getImageContext } = require('../tools/messageTools');

async function handleMention(message, client) {
  logger.info('=== BURT MENTION PROCESSING START ===');
  logger.info(`User: ${message.author.username}`);
  logger.info(`Channel: ${message.channel.name}`);
  logger.info(`Raw Message: ${message.content}`);

  let question = message.content.replace(/<@!?1307591032644571136>/g, '').trim();
  if (!question) {
    question = "Hey BURT, what's up?";
  }
  logger.info(`Processed Question: ${question}`);

  const loadingMessage = await message.reply('*[BURT twitches and starts thinking...]* 🤪');
  let imageContexts;
  try {
    imageContexts = await getImageContext(message);
    if (imageContexts?.length > 0) {
      logger.info(`Found ${imageContexts.length} images in message`);
    }
  } catch (error) {
    logger.error('Error getting image context:', error);
    imageContexts = null;
  }

  try {
    logger.info('=== BURT THINKING PROCESS ===');
    logger.info('1. Constructing initial message context...');
    const messages = [
      { 
        role: "system", 
        content: BURT_PROMPT + "\n[IMPORTANT: Format your response exactly like this:\n1. ```ascii\n[Your creative ASCII art here]\n```\n2. .-.-.-.-<Burt it up!>-.-.-.-.\n3. Your chaotic response with emojis and formatting]" 
      },
      { 
        role: "user", 
        content: `[Context: Message from user: ${message.author.username}]\n${question}`
      }
    ];

    if (imageContexts?.length > 0) {
      logger.info('2. Adding image context to message...');
      messages[1].content += "\n[Images are attached to this message. Use the analyze_image tool to see them.]";
    }

    logger.info('3. Making initial API call to Grok...');
    const completion = await openai.chat.completions.create({
      model: "grok-beta",
      messages,
      max_tokens: 1000,
      tools: functions,
      tool_choice: "auto"
    });

    let response = completion.choices[0].message;
    logger.info('4. Initial response received:', {
      content: response.content?.substring(0, 100) + '...',
      hasToolCalls: !!response.tool_calls,
      numToolCalls: response.tool_calls?.length || 0
    });

    const toolResults = [];
    if (response.tool_calls) {
      logger.info('5. Processing tool calls...');
      for (const toolCall of response.tool_calls) {
        logger.info(`  - Executing tool: ${toolCall.function.name}`);
        logger.debug(`    Arguments: ${toolCall.function.arguments}`);
        try {
          const args = JSON.parse(toolCall.function.arguments);
          if (toolCall.function.name === 'analyze_image' && imageContexts) {
            args.images = imageContexts;
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
      logger.info('6. Getting final response with tool results...');
      const messages = [
        { 
          role: "system", 
          content: BURT_PROMPT + "\n[IMPORTANT: Format your response exactly like this:\n1. ```ascii\n[Your creative ASCII art here]\n```\n2. .-.-.-.-<Burt it up!>-.-.-.-.\n3. Your chaotic response with emojis and formatting]" 
        },
        { 
          role: "user", 
          content: `[Context: Message from user: ${message.author.username}]\n${question}` 
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
      logger.info('7. Final response received');
      logger.debug('Final response content:', response.content?.substring(0, 100) + '...');
    }

    const sanitizedContent = sanitizeResponse(response.content || 'No response');
    await loadingMessage.edit(truncateForDiscord(sanitizedContent));
    logger.info('=== BURT MENTION PROCESSING COMPLETE ===');
  } catch (error) {
    logger.error('Error processing mention:', error);
    await loadingMessage.edit('*[BURT has a mental breakdown]* Sorry, something went wrong! 😵');
  }
}

module.exports = { handleMention }; 