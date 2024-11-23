const openai = require('../services/openai');
const { getRecentMessages } = require('../tools/messageTools');
const logger = require('../utils/logger');
const { truncateForDiscord, sanitizeResponse } = require('../utils/messageUtils');

async function handleAnalyze(message, content) {
  await message.channel.sendTyping();

  try {
    let analysisContent;
    if (content) {
      analysisContent = content;
    } else {
      const messages = await getRecentMessages(message.channel, 10);
      if (!messages || messages.length === 0) {
        return "No messages to analyze";
      }
      
      const imageContexts = messages.flatMap(msg => msg.images || []);
      analysisContent = messages
        .reverse()
        .map(msg => {
          let messageText = `${msg.author}: ${msg.content}`;
          if (msg.images?.length > 0) {
            messageText += ' [Attached Image]';
          }
          return messageText;
        })
        .join('\n');

      const completion = await openai.chat.completions.create({
        model: "grok-vision-beta",
        messages: [
          {
            role: 'system',
            content: 'You are an expert at analyzing conversations and text. Provide insights about the content.'
          },
          {
            role: 'user',
            content: `Please analyze this:\n${analysisContent}`,
            ...(imageContexts?.length > 0 && {
              images: imageContexts.map(img => ({
                type: "image",
                source: {
                  type: "base64",
                  data: img
                }
              }))
            })
          }
        ],
        max_tokens: 1000
      });

      return sanitizeResponse(completion.choices[0].message.content || 'No analysis available');
    }
  } catch (error) {
    logger.error('Error in analyze handler:', error);
    throw new Error('Failed to analyze content');
  }
}

module.exports = { handleAnalyze }; 