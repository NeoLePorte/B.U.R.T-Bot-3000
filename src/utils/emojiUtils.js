const EMOJI_REGEX = /<a?:.+?:\d+>|\p{Extended_Pictographic}/gu;

function isEmoji(str) {
  return EMOJI_REGEX.test(str);
}

function extractEmojis(str) {
  return str.match(EMOJI_REGEX) || [];
}

function removeEmojis(str) {
  return str.replace(EMOJI_REGEX, '').trim();
}

module.exports = {
  isEmoji,
  extractEmojis,
  removeEmojis
}; 