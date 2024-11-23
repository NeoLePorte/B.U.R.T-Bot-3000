const { encode } = require('base64-arraybuffer');
const logger = require('../utils/logger');

async function getImageContext(message) {
  try {
    const imageAttachments = message.attachments.filter(att => 
      att.contentType?.startsWith('image/'));
    
    if (imageAttachments.size === 0) return null;

    const imageContexts = await Promise.all(imageAttachments.map(async (attachment) => {
      try {
        const response = await fetch(attachment.url);
        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.statusText}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        const base64Image = encode(arrayBuffer);
        return `data:${attachment.contentType};base64,${base64Image}`;
      } catch (error) {
        logger.error('Error processing image attachment:', error);
        return null;
      }
    }));

    return imageContexts.filter(Boolean);
  } catch (error) {
    logger.error('Error in getImageContext:', error);
    return null;
  }
}

async function getRecentMessages(channel, limit = 50) {
  const messages = await channel.messages.fetch({ limit: Math.min(limit, 100) });
  const processedMessages = await Promise.all(
    Array.from(messages.values()).map(async msg => {
      const imageContexts = await getImageContext(msg);
      return {
        content: msg.content,
        author: msg.author.username,
        timestamp: msg.createdAt,
        images: imageContexts || []
      };
    })
  );
  return processedMessages;
}

const definition = {
  name: 'getRecentMessages',
  description: 'Get recent messages from the channel including any images',
  parameters: {
    type: 'object',
    properties: {
      limit: {
        type: 'number',
        description: 'Number of messages to fetch (default: 50, max: 100)',
        required: false
      }
    }
  }
};

module.exports = { 
  getRecentMessages, 
  getImageContext, 
  definition 
};