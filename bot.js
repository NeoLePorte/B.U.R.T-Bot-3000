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

      // Initial quick fetch
      const initialMessages = await interaction.channel.messages.fetch({ limit: 50 });
      const initialImages = processMessagesForImages(initialMessages);

      if (initialImages.length === 0) {
        await interaction.editReply('No images found in the recent messages!');
        return;
      }

      // Create initial gallery
      const galleryData = {
        images: initialImages,
        currentIndex: 0,
        loading: true,
        timeoutId: setTimeout(() => {
          activeGalleries.delete(interaction.channelId);
          interaction.editReply({
            content: 'Gallery closed due to inactivity.',
            embeds: [],
            components: []
          }).catch(console.error);
        }, GALLERY_TIMEOUT)
      };

      // Store gallery data
      activeGalleries.set(interaction.channelId, galleryData);

      // Send initial gallery
      await interaction.editReply(createGalleryMessage(galleryData));

      // Start background fetch
      fetchRemainingImages(interaction, galleryData).catch(console.error);

    } catch (error) {
      console.error('Error creating image gallery:', error);
      await interaction.editReply('An error occurred while creating the image gallery.');
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