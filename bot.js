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
        description: 'Number of messages to check (default: 100, max: 100)',
        type: 4, // INTEGER
        required: false
      }
    ]
  }
];

// Register commands when bot starts
client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  console.log(`Bot is in ${client.guilds.cache.size} servers`);
  try {
    await client.application.commands.set(commands);
    console.log('Commands registered successfully');
  } catch (error) {
    console.error('Error registering commands:', error);
  }
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
      
      // Pre-compile regex for better performance
      const imageRegex = /\.(jpg|jpeg|png|gif|webp)(?:\?.*)?$/i;
      const MAX_IMAGES = 100;
      const BATCH_SIZE = 20; // Smaller batches for faster initial response
      
      // Function to process a batch of messages
      const processMessageBatch = (messages) => {
        const images = [];
        for (const msg of messages.values()) {
          if (msg.attachments.size === 0) continue; // Skip messages without attachments
          
          for (const attachment of msg.attachments.values()) {
            // Quick check before regex test
            const url = attachment.url.toLowerCase();
            if (attachment.contentType?.startsWith('image/') || 
                url.endsWith('.jpg') || url.endsWith('.png') || 
                url.endsWith('.gif') || url.endsWith('.webp')) {
              images.push({
                url: attachment.url,
                author: msg.author.username,
                timestamp: msg.createdTimestamp,
                messageLink: msg.url
              });
              if (images.length >= MAX_IMAGES) break;
            }
          }
          if (images.length >= MAX_IMAGES) break;
        }
        return images;
      };

      // Initial quick fetch
      console.time('imageFetch');
      const initialMessages = await interaction.channel.messages.fetch({ limit: BATCH_SIZE });
      let images = processMessageBatch(initialMessages);
      
      // Create and send initial gallery if we have images
      if (images.length > 0) {
        const galleryData = {
          images,
          currentIndex: 0,
          timeoutId: null
        };

        const embed = new EmbedBuilder()
          .setTitle(`Image Gallery (1/${images.length}${images.length < MAX_IMAGES ? '...' : ''})`)
          .setImage(images[0].url)
          .setFooter({ 
            text: `Posted by ${images[0].author} • Click title to view original message${images.length < MAX_IMAGES ? ' • Loading more...' : ''}`
          })
          .setURL(images[0].messageLink)
          .setTimestamp(images[0].timestamp);

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

        await interaction.editReply({
          embeds: [embed],
          components: [row]
        });

        // Fetch remaining images in background if needed
        if (images.length < MAX_IMAGES) {
          const remainingMessages = await interaction.channel.messages.fetch({ 
            limit: 100,
            before: initialMessages.last().id 
          });
          
          const additionalImages = processMessageBatch(remainingMessages);
          images = images.concat(additionalImages.slice(0, MAX_IMAGES - images.length));
          
          // Update gallery with final count
          galleryData.images = images;
          
          const updatedEmbed = new EmbedBuilder()
            .setTitle(`Image Gallery (1/${images.length})`)
            .setImage(images[0].url)
            .setFooter({ 
              text: `Posted by ${images[0].author} • Click title to view original message`
            })
            .setURL(images[0].messageLink)
            .setTimestamp(images[0].timestamp);

          await interaction.editReply({
            embeds: [updatedEmbed],
            components: [row]
          });
        }

        // Set timeout and store gallery data
        galleryData.timeoutId = setTimeout(() => {
          const gallery = activeGalleries.get(interaction.channelId);
          if (gallery) {
            activeGalleries.delete(interaction.channelId);
            interaction.editReply({
              content: 'Gallery closed due to inactivity.',
              embeds: [],
              components: []
            }).catch(console.error);
          }
        }, GALLERY_TIMEOUT);

        activeGalleries.set(interaction.channelId, galleryData);
        console.timeEnd('imageFetch');
      } else {
        await interaction.editReply('No images found in the recent messages!');
      }

    } catch (error) {
      console.error('Error creating image gallery:', error);
      await interaction.editReply('An error occurred while creating the image gallery.')
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