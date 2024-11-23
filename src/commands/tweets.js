const { searchTweets } = require('../tools/searchTweets');
const { MessageEmbed } = require('discord.js');

const tweets = {
  name: 'tweets',
  description: 'Search for tweets',
  async execute(message, args) {
    if (!args.length) {
      return message.reply('Please provide a search query for tweets!');
    }

    const query = args.join(' ');
    await message.channel.sendTyping();

    try {
      const tweets = await searchTweets.execute({ 
        query, 
        limit: 5 
      });

      if (!tweets || tweets.length === 0) {
        return message.reply('No tweets found for that query.');
      }

      const embed = new MessageEmbed()
        .setTitle(`Tweet Search Results: ${query}`)
        .setColor('#1DA1F2')
        .setTimestamp();

      tweets.forEach((tweet, index) => {
        embed.addField(
          `Tweet ${index + 1}`,
          `${tweet.text}\n\nPosted: ${new Date(tweet.created_at).toLocaleDateString()}`
        );
      });

      await message.reply({ embeds: [embed] });

    } catch (error) {
      console.error('Error in tweets command:', error);
      await message.reply('Sorry, I encountered an error while searching for tweets.');
    }
  }
};

module.exports = tweets; 