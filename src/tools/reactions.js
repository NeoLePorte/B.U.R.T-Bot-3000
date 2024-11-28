// Tool for BURT to react to messages
const reactionTool = {
  name: 'react',
  description: 'React to a message with an emoji',
  parameters: {
    type: 'object',
    properties: {
      emoji: {
        type: 'string',
        description: 'The emoji to react with'
      },
      messageId: {
        type: 'string',
        description: 'The ID of the message to react to'
      },
      channelId: {
        type: 'string',
        description: 'The ID of the channel containing the message'
      }
    },
    required: ['emoji', 'messageId', 'channelId']
  },

  async execute(args, message, client) {
    try {
      const { emoji, messageId, channelId } = args;
      
      // Get the channel
      const channel = await client.channels.fetch(channelId);
      if (!channel) {
        return {
          success: false,
          error: 'Channel not found'
        };
      }

      // Get the message
      const targetMessage = await channel.messages.fetch(messageId);
      if (!targetMessage) {
        return {
          success: false,
          error: 'Message not found'
        };
      }

      // React with the emoji
      await targetMessage.react(emoji);
      
      return {
        success: true,
        message: `Successfully reacted with ${emoji}`
      };
    } catch (error) {
      console.error('Error in react tool:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
};

module.exports = reactionTool; 