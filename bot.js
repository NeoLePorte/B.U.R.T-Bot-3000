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
    console.log('Clearing existing commands...');
    await client.application.commands.set([]);
    
    console.log('Registering new commands...');
    const registeredCommands = await client.application.commands.set(commands);
    console.log('Registered commands:', registeredCommands.map(cmd => cmd.name).join(', '));
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
      console.time('initialTweetFetch');
      
      const MAX_TWEETS = 100;
      const INITIAL_FETCH = 50;
      const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
      let tweets = [];
      let lastId = null;
      let isLoading = true;

      // Regular expressions
      const tweetRegex = /https?:\/\/(?:www\.)?(twitter\.com|x\.com)\/\w+\/status\/\d+/gi;
      const imageRegex = /https:\/\/pbs\.twimg\.com\/media\/[^\s]+/g;

      // Process messages function
      const processMessages = (messages) => {
        console.log(`Processing ${messages.size} messages`);
        const newTweets = [];
        
        for (const msg of messages.values()) {
          // Stop if message is older than 24 hours
          if (msg.createdTimestamp < oneDayAgo) {
            console.log('Reached message older than 24 hours');
            return { tweets: newTweets, reachedEnd: true };
          }

          const tweetMatches = Array.from(msg.content.matchAll(tweetRegex));
          if (tweetMatches.length === 0) continue;

          console.log(`Found ${tweetMatches.length} tweet matches`);

          let tweetImage = null;
          if (msg.embeds.length > 0) {
            const imageEmbed = msg.embeds.find(embed => embed.image || embed.thumbnail);
            if (imageEmbed?.image) {
              tweetImage = imageEmbed.image.url;
            } else if (imageEmbed?.thumbnail) {
              tweetImage = imageEmbed.thumbnail.url;
            }
          }

          for (const match of tweetMatches) {
            const tweetUrl = match[0];
            newTweets.push({
              url: tweetUrl,
              author: msg.author.username,
              timestamp: msg.createdTimestamp,
              messageLink: msg.url,
              content: msg.content,
              image: tweetImage
            });
          }
        }
        
        return { tweets: newTweets, reachedEnd: false };
      };

      // Initial fetch
      console.log('Starting initial fetch...');
      const initialMessages = await interaction.channel.messages.fetch({ limit: INITIAL_FETCH });
      console.log(`Fetched ${initialMessages.size} initial messages`);
      
      const initialResult = processMessages(initialMessages);
      tweets = initialResult.tweets;
      
      if (initialMessages.size > 0) {
        lastId = initialMessages.last().id;
      }

      console.log(`Initial tweets found: ${tweets.length}`);
      console.timeEnd('initialTweetFetch');
      
      if (tweets.length === 0) {
        await interaction.editReply('No X/Twitter links found in the recent messages! Searching further back...');
        
        // Immediate additional fetch if no tweets found initially
        const additionalMessages = await interaction.channel.messages.fetch({ 
          limit: 100,
          before: lastId 
        });
        
        if (additionalMessages.size > 0) {
          const additionalResult = processMessages(additionalMessages);
          tweets = additionalResult.tweets;
          lastId = additionalMessages.last().id;
        }
        
        if (tweets.length === 0) {
          await interaction.editReply('No X/Twitter links found in the past 24 hours.');
          return;
        }
      }

      // Create gallery data and UI elements
      const createEmbed = (tweet, index, total) => {
        const embed = new EmbedBuilder()
          .setTitle(`Tweet Links (${index + 1}/${total}${isLoading ? '+' : ''})`)
          .setDescription(`[View Tweet](${tweet.url})\n\nContext: ${tweet.content.substring(0, 200)}${tweet.content.length > 200 ? '...' : ''}`)
          .setFooter({ 
            text: `Posted by ${tweet.author} • Click title to view original message${isLoading ? ' • Loading more...' : ''}`
          })
          .setURL(tweet.messageLink)
          .setTimestamp(tweet.timestamp)
          .setColor('#1DA1F2');

        if (tweet.image) {
          embed.setImage(tweet.image);
        }

        return embed;
      };

      const galleryData = {
        tweets,
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

      const createRow = (currentIndex, totalTweets) => {
        return new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('prev')
              .setLabel('Previous')
              .setStyle(ButtonStyle.Primary)
              .setDisabled(currentIndex === 0),
            new ButtonBuilder()
              .setCustomId('next')
              .setLabel('Next')
              .setStyle(ButtonStyle.Primary)
              .setDisabled(currentIndex === totalTweets - 1),
            new ButtonBuilder()
              .setCustomId('close')
              .setLabel('Close Gallery')
              .setStyle(ButtonStyle.Danger)
          );
      };

      // Send initial gallery
      await interaction.editReply({
        embeds: [createEmbed(tweets[0], 0, tweets.length)],
        components: [createRow(0, tweets.length)]
      });

      activeGalleries.set(interaction.channelId, galleryData);

      // Background loading
      (async () => {
        try {
          let reachedEnd = false;
          
          while (!reachedEnd && tweets.length < MAX_TWEETS && lastId) {
            const messages = await interaction.channel.messages.fetch({ 
              limit: 100,
              before: lastId 
            });
            
            if (messages.size === 0) break;
            
            const result = processMessages(messages);
            if (result.tweets.length > 0) {
              tweets.push(...result.tweets);
              if (tweets.length > MAX_TWEETS) {
                tweets = tweets.slice(0, MAX_TWEETS);
                break;
              }
              
              galleryData.tweets = tweets;
              
              // Update the current view if needed
              if (galleryData.currentIndex === 0) {
                await interaction.editReply({
                  embeds: [createEmbed(tweets[0], 0, tweets.length)],
                  components: [createRow(0, tweets.length)]
                });
              }
            }
            
            if (result.reachedEnd) {
              reachedEnd = true;
              break;
            }
            
            lastId = messages.last().id;
          }
          
          isLoading = false;
          console.log(`Final tweet count: ${tweets.length}`);
          
          // Final update
          await interaction.editReply({
            embeds: [createEmbed(tweets[galleryData.currentIndex], galleryData.currentIndex, tweets.length)],
            components: [createRow(galleryData.currentIndex, tweets.length)]
          });
        } catch (error) {
          console.error('Error in background loading:', error);
        }
      })();

    } catch (error) {
      console.error('Error creating tweet gallery:', error);
      await interaction.editReply('An error occurred while creating the tweet gallery.')
        .catch(() => console.error('Failed to send error message'));
    }
  }
});

// Button interaction handler
client.on('interactionCreate', async interaction => {
  if (!interaction.isButton()) return;

  const gallery = activeGalleries.get(interaction.channelId);
  if (!gallery) return;

  try {
    await interaction.deferUpdate();

    if (interaction.customId === 'close') {
      clearTimeout(gallery.timeoutId);
      activeGalleries.delete(interaction.channelId);
      await interaction.editReply({
        content: 'Gallery closed.',
        embeds: [],
        components: []
      });
      return;
    }

    const items = gallery.tweets || gallery.images;
    let newIndex = gallery.currentIndex;

    if (interaction.customId === 'next' && newIndex < items.length - 1) {
      newIndex = newIndex + 1;
    } else if (interaction.customId === 'prev' && newIndex > 0) {
      newIndex = newIndex - 1;
    }

    gallery.currentIndex = newIndex;

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('prev')
          .setLabel('Previous')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(newIndex === 0),
        new ButtonBuilder()
          .setCustomId('next')
          .setLabel('Next')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(newIndex === items.length - 1),
        new ButtonBuilder()
          .setCustomId('close')
          .setLabel('Close Gallery')
          .setStyle(ButtonStyle.Danger)
      );

    if (gallery.tweets) {
      const currentTweet = items[newIndex];
      const embed = new EmbedBuilder()
        .setTitle(`Tweet Links (${newIndex + 1}/${items.length})`)
        .setDescription(`[View Tweet](${currentTweet.url})\n\nContext: ${currentTweet.content.substring(0, 200)}${currentTweet.content.length > 200 ? '...' : ''}`)
        .setFooter({ 
          text: `Posted by ${currentTweet.author} • Click title to view original message`
        })
        .setURL(currentTweet.messageLink)
        .setTimestamp(currentTweet.timestamp)
        .setColor('#1DA1F2');

      if (currentTweet.image) {
        embed.setImage(currentTweet.image);
      }

      await interaction.editReply({
        embeds: [embed],
        components: [row]
      });
    } else {
      const currentImage = items[newIndex];
      const embed = new EmbedBuilder()
        .setTitle(`Image Gallery (${newIndex + 1}/${items.length})`)
        .setImage(currentImage.url)
        .setFooter({ 
          text: `Posted by ${currentImage.author} • Click title to view original message`
        })
        .setURL(currentImage.messageLink)
        .setTimestamp(currentImage.timestamp);

      await interaction.editReply({
        embeds: [embed],
        components: [row]
      });
    }

  } catch (error) {
    console.error('Error handling button interaction:', error);
  }
});

// Error handling
client.on('error', error => {
  console.error('Discord client error:', error);
});

// Login
client.login(process.env.DISCORD_TOKEN); 