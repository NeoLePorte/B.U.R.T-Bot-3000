const openai = require('../services/openai');
const { getRecentMessages } = require('./messageTools');

async function analyzeContent(message, content) {
  let analysisContent;
  if (content) {
    analysisContent = content;
  } else {
    const messages = await getRecentMessages(message.channel, 10);
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
          ...(imageContexts.length > 0 && {
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

    return completion.choices[0].message.content;
  }
}

const definition = {
  name: 'analyzeContent',
  description: 'Analyze conversation content and images in the channel',
  parameters: {
    type: 'object',
    properties: {
      content: {
        type: 'string',
        description: 'Specific content to analyze. If not provided, will analyze recent messages.',
        required: false
      }
    }
  }
};

module.exports = {
  analyzeContent,
  definition
}; 