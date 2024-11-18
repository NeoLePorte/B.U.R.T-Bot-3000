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

// Handle slash commands
client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;
  console.log(`Command "${interaction.commandName}" used by ${interaction.user.tag}`);

  const { commandName, options } = interaction;

  if (commandName === 'images') {
    try {
      await interaction.deferReply({ ephemeral: true });

      const MAX_IMAGES = 100;
      const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
      let images = [];
      let lastId = null;
      const BATCH_SIZE = 100;
      
      // Pre-compile the image extension regex for better performance
      const imageRegex = /\.(jpg|jpeg|png|gif|webp)(?:\?.*)?$/i;

      while (images.length < MAX_IMAGES) {
        const messages = await interaction.channel.messages.fetch({ 
          limit: BATCH_SIZE, 
          before: lastId 
        });
        
        if (messages.size === 0) break;
        lastId = messages.last().id;

        // Process messages in this batch
        for (const msg of messages.values()) {
          if (msg.createdTimestamp < oneDayAgo) {
            // Exit both loops if we're past 24 hours
            messages.clear();
            break;
          }

          // Quick check if message has attachments before processing
          if (msg.attachments.size === 0) continue;

          // Process attachments
          for (const attachment of msg.attachments.values()) {
            if (images.length >= MAX_IMAGES) break;
            
            // Faster image check using regex
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
      }

      console.log(`Found ${images.length} images`);

      if (images.length === 0) {
        await interaction.editReply('No images found in the recent messages!');
        return;
      }

      // Create gallery data
      const galleryData = {
        images,
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

      // Store gallery data
      activeGalleries.set(interaction.channelId, galleryData);

      // Create embed for first image
      const embed = new EmbedBuilder()
        .setTitle(`Image Gallery (1/${galleryData.images.length})`)
        .setImage(galleryData.images[0].url)
        .setFooter({ 
          text: `Posted by ${galleryData.images[0].author} • Click title to view original message`
        })
        .setURL(galleryData.images[0].messageLink)
        .setTimestamp(galleryData.images[0].timestamp);

      // Create navigation buttons change test.
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
            .setDisabled(galleryData.images.length === 1),
          new ButtonBuilder()
            .setCustomId('close')
            .setLabel('Close Gallery')
            .setStyle(ButtonStyle.Danger)
        );

      await interaction.editReply({
        embeds: [embed],
        components: [row]
      });
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