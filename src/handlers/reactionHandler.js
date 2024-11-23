const { BURT_CHANNEL_ID } = require('../config/constants');
const openai = require('../services/openai');
const { getImageContext } = require('../tools/messageTools');

async function handleReactionAdd(reaction, user) {
  if (user.bot) return;
  
  if (reaction.message.channel.id === BURT_CHANNEL_ID) {
    // React back to user reactions sometimes
    if (Math.random() > 0.5) {
      try {
        await reaction.message.react(reaction.emoji);
      } catch (error) {
        console.error('Error reacting to reaction:', error);
      }
    }
  }
}

async function handleNaturalReaction(message) {
  const delay = Math.floor(Math.random() * 1500) + 500;
  await new Promise(resolve => setTimeout(resolve, delay));
  
  try {
    const imageContexts = await getImageContext(message);
    const emoji = await getContextualEmoji(message.content, imageContexts);
    if (emoji) {
      await message.react(emoji);
    }
  } catch (error) {
    console.error('Error adding natural reaction:', error);
  }
}

async function getContextualEmoji(content, imageContexts) {
  try {
    const completion = await openai.chat.completions.create({
      model: "grok-vision-beta",
      messages: [
        {
          role: "system",
          content: "You are BURT. Choose a single appropriate emoji for the following message and any attached images. Respond with just the emoji."
        },
        {
          role: "user",
          content: content,
          ...(imageContexts && {
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
      max_tokens: 10
    });
    
    return completion.choices[0].message.content.trim();
  } catch (error) {
    console.error('Error getting contextual emoji:', error);
    return '🤪'; // Default BURT emoji
  }
}

module.exports = {
  handleReactionAdd,
  handleNaturalReaction,
  getContextualEmoji
}; 