const { Client, GatewayIntentBits } = require('discord.js');
const config = require('../config/constants');
const logger = require('../utils/logger');

class DiscordService {
  constructor() {
    try {
      console.log('Initializing Discord Service');
      this.client = new Client({
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildMessages,
          GatewayIntentBits.MessageContent,
          GatewayIntentBits.GuildMessageReactions
        ]
      });

      // Add error event handlers
      this.client.on('error', error => {
        console.error('Discord Client Error:', error.message);
      });

      this.client.on('warn', warning => {
        console.warn('Discord Client Warning:', warning);
      });
    } catch (error) {
      console.error('Error in DiscordService constructor:', error);
      throw error;
    }
  }

  async init() {
    logger.info('Starting Discord initialization');
    logger.debug('Token check:', { 
      exists: !!config.DISCORD_TOKEN,
      length: config.DISCORD_TOKEN?.length
    });
    
    if (!config.DISCORD_TOKEN) {
      logger.error('DISCORD_TOKEN is missing');
      throw new Error('DISCORD_TOKEN is not set in environment variables');
    }

    try {
      await this.client.login(config.DISCORD_TOKEN);
      logger.info(`Logged in successfully as ${this.client.user.tag}`);
    } catch (error) {
      logger.error('Failed to login to Discord:', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }
}

module.exports = new DiscordService(); 