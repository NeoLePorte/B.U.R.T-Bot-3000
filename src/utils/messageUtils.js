const DISCORD_MAX_LENGTH = 1000;

function truncateMessage(message, maxLength = DISCORD_MAX_LENGTH) {
  if (!message || typeof message !== 'string') return '';
  if (message.length <= maxLength) return message;
  return message.slice(0, maxLength - 3) + '...';
}

function truncateForDiscord(text) {
  if (!text || typeof text !== 'string') {
    return 'BURT.exe has stopped working... 🤖💫';
  }
  
  let sanitized = text
    .replace(/```/g, '`‎``')
    .replace(/@everyone/g, '@\u200beveryone')
    .replace(/@here/g, '@\u200bhere')
    .trim();

  if (sanitized.length > DISCORD_MAX_LENGTH) {
    sanitized = sanitized.slice(0, DISCORD_MAX_LENGTH - 3) + '...';
  }
  
  return sanitized;
}

function sanitizeResponse(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/`/g, '\'')
    .replace(/@everyone/g, '@\u200beveryone')
    .replace(/@here/g, '@\u200bhere')
    .replace(/<@&/g, '<@\u200b&')
    .trim();
}

function isCommand(message) {
  return message.content.startsWith('!');
}

module.exports = {
  truncateMessage,
  truncateForDiscord,
  sanitizeResponse,
  isCommand
}; 