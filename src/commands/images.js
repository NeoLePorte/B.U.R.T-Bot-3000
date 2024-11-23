const openai = require('../services/openai');
const { GalleryManager } = require('../utils/galleryUtils');
const { searchGif } = require('../tools/searchGif');

const images = {
  name: 'images',
  description: 'Generate or search for images',
  async execute(message, args) {
    if (!args.length) {
      return message.reply('Please provide a prompt for the image!');
    }

    const prompt = args.join(' ');
    await message.channel.sendTyping();

    try {
      // First try to generate with DALL-E
      const imageResponse = await openai.createImage({
        prompt,
        n: 4,
        size: '1024x1024'
      });

      const generatedImages = imageResponse.data.data.map(img => ({
        url: img.url,
        prompt
      }));

      // If no DALL-E results, fallback to GIF search
      if (!generatedImages.length) {
        const gifs = await searchGif.execute({ query: prompt, limit: 4 });
        generatedImages.push(...gifs);
      }

      if (!generatedImages.length) {
        return message.reply('Sorry, I couldn\'t generate or find any images for that prompt.');
      }

      // Create gallery for user
      GalleryManager.createGallery(message.author.id, generatedImages);

      // Send first image with navigation controls
      const messageResponse = await message.channel.send({
        embeds: [{
          title: `Image 1/${generatedImages.length}`,
          image: { url: generatedImages[0].url }
        }]
      });

      // Add navigation reactions
      await messageResponse.react('⬅️');
      await messageResponse.react('➡️');
      await messageResponse.react('❌');

    } catch (error) {
      console.error('Error in images command:', error);
      await message.reply('Sorry, I encountered an error while processing your image request.');
    }
  }
};

module.exports = images; 