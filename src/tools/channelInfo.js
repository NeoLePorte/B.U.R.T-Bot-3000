async function getChannelInfo(channel) {
  return {
    name: channel.name,
    type: channel.type,
    topic: channel.topic,
    parentName: channel.parent?.name,
    isNSFW: channel.nsfw
  };
}

const definition = {
  name: 'getChannelInfo',
  description: 'Get information about the current channel',
  parameters: {
    type: 'object',
    properties: {}
  }
};

module.exports = { getChannelInfo, definition }; 