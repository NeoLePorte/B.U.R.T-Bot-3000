async function interactionHandler(interaction) {
  if (!interaction.isCommand()) return;

  const { commandName } = interaction;
  
  try {
    if (commandName === 'ask') {
      await commands.ask.execute(interaction);
    } else {
      await interaction.reply({ 
        content: 'Unknown command',
        ephemeral: true 
      });
    }
  } catch (error) {
    logger.error('Interaction handling error:', error);
    await interaction.reply({ 
      content: 'Sorry, there was an error processing your command.',
      ephemeral: true 
    });
  }
}

module.exports = interactionHandler; 