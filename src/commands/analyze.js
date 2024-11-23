const { handleAnalyze } = require('../handlers/analyzeHandler');

const analyze = {
  name: 'analyze',
  description: 'Analyze recent conversation or provided text',
  async execute(message, args) {
    try {
      const content = args.length > 0 ? args.join(' ') : null;
      const analysis = await handleAnalyze(message, content);
      await message.reply(analysis);
    } catch (error) {
      console.error('Error in analyze command:', error);
      await message.reply('Sorry, I encountered an error while analyzing the content.');
    }
  }
};

module.exports = analyze; 