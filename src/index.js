require('dotenv').config();
const discordService = require('./services/discord');
const messageHandler = require('./handlers/messageHandler');
const logger = require('./utils/logger');
const { BURT_CHANNEL_ID } = require('./config/constants');

process.on('unhandledRejection', (error) => {
  logger.error('Unhandled promise rejection:', {
    error: error.message,
    stack: error.stack
  });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', {
    error: error.message,
    stack: error.stack
  });
  process.exit(1);
});

// Initialize Discord client
discordService.client.on('ready', () => {
  logger.info(`Bot is ready and logged in as ${discordService.client.user.tag}`);
});

discordService.client.on('messageCreate', (message) => {
  const isBurtChannel = message.channel.id === BURT_CHANNEL_ID;
  const isBurtMentioned = message.mentions.users.has(discordService.client.user.id);
  const isInBurtThread = message.channel.isThread() && message.channel.parentId === BURT_CHANNEL_ID;

  // Only process messages in BURT's channel, threads, or when mentioned
  if (!isBurtChannel && !isBurtMentioned && !isInBurtThread) {
    return;
  }

  logger.debug('Message received event triggered');
  messageHandler(message, discordService.client);
});

// Start the bot
discordService.init().catch(error => {
  logger.error('Failed to initialize Discord service:', {
    error: error.message,
    stack: error.stack
  });
  process.exit(1);
});
  