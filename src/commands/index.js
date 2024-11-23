const ask = require('./ask');
const analyze = require('./analyze');
const images = require('./images');
const tweets = require('./tweets');

const commands = {
  ask,
  analyze,
  images,
  tweets
};

async function handleCommand(message) {
  const args = message.content.slice(1).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  if (!commands[command]) {
    return message.reply('Unknown command. Try !ask, !analyze, !images, or !tweets');
  }

  try {
    await commands[command].execute(message, args);
  } catch (error) {
    console.error(`Error executing command ${command}:`, error);
    await message.reply('There was an error executing that command.');
  }
}

module.exports = {
  handleCommand,
  commands
}; 