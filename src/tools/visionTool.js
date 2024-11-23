const openai = require('../services/openai');
const logger = require('../utils/logger');

const definition = {
  name: 'analyze_image',
  description: 'Analyze images in the message using vision model. Use this when you need to understand or describe images.',
  parameters: {
    type: 'object',
    properties: {
      images: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['image'] },
            source: {
              type: 'object',
              properties: {
                type: { type: 'string', enum: ['base64'] },
                data: { type: 'string' }
              },
              required: ['type', 'data']
            }
          },
          required: ['type', 'source']
        }
      }
    },
    required: ['images']
  }
};

async function analyzeImage(args) {
  try {
    logger.info('Analyzing image with vision model...');
    
    if (!args.images || !Array.isArray(args.images)) {
      throw new Error('No valid images provided');
    }

    const formattedImages = args.images.map(img => {
      if (img.type === 'image' && img.source?.type === 'base64') {
        return img;
      }
      return {
        type: 'image',
        source: {
          type: 'base64',
          data: img
        }
      };
    });

    const completion = await openai.chat.completions.create({
      model: "grok-vision-beta",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "What do you see in this image? Be detailed but concise." },
            ...formattedImages
          ]
        }
      ],
      max_tokens: 500
    });

    return completion.choices[0].message.content;
  } catch (error) {
    logger.error('Vision analysis failed:', error);
    return "Failed to analyze image";
  }
}

module.exports = {
  analyzeImage,
  definition
}; 