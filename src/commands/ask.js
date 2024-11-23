const { BURT_PROMPT } = require('../config/constants');
const openai = require('../services/openai');
const { executeToolCall } = require('../tools');

const ask = {
  name: 'ask',
  description: 'Ask BURT a question',
  async execute(interaction) {
    const question = interaction.options.getString('question');
    
    await interaction.deferReply();

    try {
      const completion = await openai.chat.completions.create({
        model: "grok-beta",
        messages: [
          { 
            role: "system", 
            content: BURT_PROMPT + "\nIMPORTANT: Keep responses under 4000 characters." 
          },
          { 
            role: "user", 
            content: `[Context: Command from user: ${interaction.user.username}]\n${question}` 
          }
        ],
        max_tokens: 1000,
        tools: functions,
        tool_choice: "auto"
      });

      // Rest of the tool handling logic
    } catch (error) {
      console.error('Error in ask command:', error);
      await interaction.editReply('*[BURT has a mental breakdown]* Sorry, something went wrong! 😵');
    }
  }
};

module.exports = ask; 