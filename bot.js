const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.DirectMessages,
  ]
});

// Store active image galleries (channelId -> gallery data)
const activeGalleries = new Map();

// Add timeout constant
const GALLERY_TIMEOUT = 5 * 60 * 1000; // 5 minutes

// Command setup
const commands = [
  {
    name: 'images',
    description: 'Show recent images in the channel',
    options: [
      {
        name: 'amount',
        description: 'Number of images to show (default: 100, max: 100)',
        type: 4,
        required: false
      }
    ]
  },
  {
    name: 'tweets',
    description: 'Show recent X/Twitter links in the channel',
    options: [
      {
        name: 'amount',
        description: 'Number of messages to check (default: 100, max: 100)',
        type: 4,
        required: false
      }
    ]
  }
];

// Register commands when bot starts
client.once('ready', async () => {
  try {
    console.log('Registering commands...');
    await client.application.commands.set(commands);
    console.log('Commands registered successfully');
  } catch (error) {
    console.error('Error registering commands:', error);
  }
  
  console.log(`Logged in as ${client.user.tag}`);
});

// Helper function to process messages for images
function processMessagesForImages(messages) {
  const imageRegex = /\.(jpg|jpeg|png|gif|webp)(?:\?.*)?$/i;
  const images = [];

  for (const msg of messages.values()) {
    for (const attachment of msg.attachments.values()) {
      if (imageRegex.test(attachment.url) || attachment.contentType?.startsWith('image/')) {
        images.push({
          url: attachment.url,
          author: msg.author.username,
          timestamp: msg.createdTimestamp,
          messageLink: msg.url
        });
      }
    }
  }
  return images;
}

// Create gallery message
function createGalleryMessage(galleryData) {
  const currentImage = galleryData.images[galleryData.currentIndex];
  const embed = new EmbedBuilder()
    .setTitle(`Image Gallery (${galleryData.currentIndex + 1}/${galleryData.images.length}${galleryData.loading ? '+' : ''})`)
    .setImage(currentImage.url)
    .setFooter({ 
      text: `Posted by ${currentImage.author} • Click title to view original message${galleryData.loading ? ' • Loading more images...' : ''}`
    })
    .setURL(currentImage.messageLink)
    .setTimestamp(currentImage.timestamp);

  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('prev')
        .setLabel('Previous')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(galleryData.currentIndex === 0),
      new ButtonBuilder()
        .setCustomId('next')
        .setLabel('Next')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(galleryData.currentIndex === galleryData.images.length - 1),
      new ButtonBuilder()
        .setCustomId('close')
        .setLabel('Close Gallery')
        .setStyle(ButtonStyle.Danger)
    );

  return { embeds: [embed], components: [row] };
}

// Background fetch function
async function fetchRemainingImages(interaction, galleryData) {
  const MAX_IMAGES = 100;
  const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
  let lastId = galleryData.images[galleryData.images.length - 1]?.messageLink.split('/').pop();
  
  while (galleryData.images.length < MAX_IMAGES) {
    const messages = await interaction.channel.messages.fetch({ 
      limit: 100, 
      before: lastId 
    });
    
    if (messages.size === 0) break;
    lastId = messages.last().id;

    // Check if we've gone past 24 hours
    if (messages.last().createdTimestamp < oneDayAgo) break;

    const newImages = processMessagesForImages(messages);
    if (newImages.length === 0) break;

    // Add new images and update gallery
    galleryData.images.push(...newImages);
    if (galleryData.images.length > MAX_IMAGES) {
      galleryData.images = galleryData.images.slice(0, MAX_IMAGES);
      break;
    }

    // Update gallery message every 20 new images
    if (newImages.length >= 20) {
      try {
        await interaction.editReply(createGalleryMessage(galleryData));
      } catch (error) {
        console.error('Failed to update gallery:', error);
        break;
      }
    }
  }

  // Final update
  galleryData.loading = false;
  try {
    await interaction.editReply(createGalleryMessage(galleryData));
  } catch (error) {
    console.error('Failed to update gallery:', error);
  }
}

// Handle slash commands
client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;
  console.log(`Command "${interaction.commandName}" used by ${interaction.user.tag}`);

  const { commandName, options } = interaction;

  if (commandName === 'images') {
    try {
      await interaction.deferReply({ ephemeral: true });
      console.time('imageFetch');
      
      const MAX_IMAGES = 100;
      const FETCH_TIMEOUT = 15000; // 15 seconds
      const imageRegex = /\.(jpg|jpeg|png|gif|webp)(?:\?.*)?$/i;
      let images = [];
      let lastId = null;

      // Create a promise that resolves after timeout
      const timeoutPromise = new Promise((resolve) => {
        setTimeout(() => resolve('timeout'), FETCH_TIMEOUT);
      });

      // Image fetching function
      const fetchImages = async () => {
        while (images.length < MAX_IMAGES) {
          const messages = await interaction.channel.messages.fetch({ 
            limit: 100,
            before: lastId 
          });
          
          if (messages.size === 0) break;
          lastId = messages.last().id;

          // Process messages for images
          for (const msg of messages.values()) {
            if (msg.attachments.size === 0) continue;

            for (const attachment of msg.attachments.values()) {
              const url = attachment.url.toLowerCase();
              if (attachment.contentType?.startsWith('image/') || imageRegex.test(url)) {
                images.push({
                  url: attachment.url,
                  author: msg.author.username,
                  timestamp: msg.createdTimestamp,
                  messageLink: msg.url
                });
                if (images.length >= MAX_IMAGES) return;
              }
            }
          }
        }
      };

      // Race between fetch and timeout
      await Promise.race([fetchImages(), timeoutPromise]);
      console.timeEnd('imageFetch');
      
      if (images.length === 0) {
        await interaction.editReply('No images found in the recent messages!');
        return;
      }

      console.log(`Found ${images.length} images`);

      // Create gallery data
      const galleryData = {
        images,
        currentIndex: 0,
        timeoutId: setTimeout(() => {
          const gallery = activeGalleries.get(interaction.channelId);
          if (gallery) {
            activeGalleries.delete(interaction.channelId);
            interaction.editReply({
              content: 'Gallery closed due to inactivity.',
              embeds: [],
              components: []
            }).catch(console.error);
          }
        }, GALLERY_TIMEOUT)
      };

      // Create initial embed
      const embed = new EmbedBuilder()
        .setTitle(`Image Gallery (1/${images.length})`)
        .setImage(images[0].url)
        .setFooter({ 
          text: `Posted by ${images[0].author} • Click title to view original message`
        })
        .setURL(images[0].messageLink)
        .setTimestamp(images[0].timestamp);

      // Create navigation row
      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('prev')
            .setLabel('Previous')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(true),
          new ButtonBuilder()
            .setCustomId('next')
            .setLabel('Next')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(images.length === 1),
          new ButtonBuilder()
            .setCustomId('close')
            .setLabel('Close Gallery')
            .setStyle(ButtonStyle.Danger)
        );

      // Store gallery data and send response
      activeGalleries.set(interaction.channelId, galleryData);
      await interaction.editReply({
        embeds: [embed],
        components: [row]
      });

    } catch (error) {
      console.error('Error creating image gallery:', error);
      await interaction.editReply('An error occurred while creating the image gallery.')
        .catch(() => console.error('Failed to send error message'));
    }
  } else if (commandName === 'tweets') {
    try {
      await interaction.deferReply({ ephemeral: true });
      console.time('tweetFetch');
      
      const MAX_TWEETS = 50;
      const FETCH_TIMEOUT = 15000; // 15 seconds
      let tweets = [];
      let lastId = null;

      // Regular expressions for X/Twitter URLs
      const tweetRegex = /(?:https?:\/\/)?(?:www\.)?(twitter\.com|x\.com)\/[a-zA-Z0-9_]+\/status\/[0-9]+/g;

      // Tweet fetching function
      const fetchTweets = async () => {
        while (tweets.length < MAX_TWEETS) {
          const messages = await interaction.channel.messages.fetch({ 
            limit: 100,
            before: lastId 
          });
          
          if (messages.size === 0) break;
          lastId = messages.last().id;

          // Process messages for tweets
          for (const msg of messages.values()) {
            const matches = msg.content.match(tweetRegex);
            if (!matches) continue;

            for (const url of matches) {
              tweets.push({
                url: url,
                author: msg.author.username,
                timestamp: msg.createdTimestamp,
                messageLink: msg.url,
                content: msg.content
              });
              if (tweets.length >= MAX_TWEETS) return;
            }
          }
        }
      };

      // Create a promise that resolves after timeout
      const timeoutPromise = new Promise((resolve) => {
        setTimeout(() => resolve('timeout'), FETCH_TIMEOUT);
      });

      // Race between fetch and timeout
      await Promise.race([fetchTweets(), timeoutPromise]);
      console.timeEnd('tweetFetch');
      
      if (tweets.length === 0) {
        await interaction.editReply('No X/Twitter links found in the recent messages!');
        return;
      }

      console.log(`Found ${tweets.length} tweets`);

      // Create embed pages for tweets
      const embeds = tweets.map((tweet, index) => {
        return new EmbedBuilder()
          .setTitle(`Tweet Links (${index + 1}/${tweets.length})`)
          .setDescription(`[View Tweet](${tweet.url})\n\nContext: ${tweet.content.substring(0, 200)}${tweet.content.length > 200 ? '...' : ''}`)
          .setFooter({ 
            text: `Posted by ${tweet.author} • Click title to view original message`
          })
          .setURL(tweet.messageLink)
          .setTimestamp(tweet.timestamp)
          .setColor('#1DA1F2'); // Twitter blue color
      });

      // Create gallery data
      const galleryData = {
        embeds,
        currentIndex: 0,
        timeoutId: setTimeout(() => {
          activeGalleries.delete(interaction.channelId);
          interaction.editReply({
            content: 'Gallery closed due to inactivity.',
            embeds: [],
            components: []
          }).catch(console.error);
        }, GALLERY_TIMEOUT)
      };

      // Create navigation row
      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('prev')
            .setLabel('Previous')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(true),
          new ButtonBuilder()
            .setCustomId('next')
            .setLabel('Next')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(tweets.length === 1),
          new ButtonBuilder()
            .setCustomId('close')
            .setLabel('Close Gallery')
            .setStyle(ButtonStyle.Danger)
        );

      // Store gallery data and send response
      activeGalleries.set(interaction.channelId, galleryData);
      await interaction.editReply({
        embeds: [embeds[0]],
        components: [row]
      });

    } catch (error) {
      console.error('Error creating tweet gallery:', error);
      await interaction.editReply('An error occurred while creating the tweet gallery.')
        .catch(() => console.error('Failed to send error message'));
    }
  }
});

// Handle button interactions
client.on('interactionCreate', async interaction => {
  if (!interaction.isButton()) return;

  const galleryData = activeGalleries.get(interaction.channelId);
  if (!galleryData || interaction.user.id !== interaction.message.interaction.user.id) return;

  const { customId } = interaction;

  if (customId === 'close') {
    clearTimeout(galleryData.timeoutId);
    activeGalleries.delete(interaction.channelId);
    await interaction.update({
      content: 'Gallery closed.',
      embeds: [],
      components: []
    });
    return;
  }

  // Handle navigation
  if (customId === 'prev') {
    galleryData.currentIndex--;
  } else if (customId === 'next') {
    galleryData.currentIndex++;
  }

  // Reset timeout
  clearTimeout(galleryData.timeoutId);
  galleryData.timeoutId = setTimeout(() => {
    activeGalleries.delete(interaction.channelId);
    interaction.update({
      content: 'Gallery closed due to inactivity.',
      embeds: [],
      components: []
    }).catch(console.error);
  }, GALLERY_TIMEOUT);

  const currentImage = galleryData.images[galleryData.currentIndex];
  const embed = new EmbedBuilder()
    .setTitle(`Image Gallery (${galleryData.currentIndex + 1}/${galleryData.images.length})`)
    .setImage(currentImage.url)
    .setFooter({ 
      text: `Posted by ${currentImage.author} • Click title to view original message`
    })
    .setURL(currentImage.messageLink)
    .setTimestamp(currentImage.timestamp);

  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('prev')
        .setLabel('Previous')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(galleryData.currentIndex === 0),
      new ButtonBuilder()
        .setCustomId('next')
        .setLabel('Next')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(galleryData.currentIndex === galleryData.images.length - 1),
      new ButtonBuilder()
        .setCustomId('close')
        .setLabel('Close Gallery')
        .setStyle(ButtonStyle.Danger)
    );

  await interaction.update({
    embeds: [embed],
    components: [row]
  });
});

// Error handling
client.on('error', error => {
  console.error('Discord client error:', error);
});

// Login
client.login(process.env.DISCORD_TOKEN); 