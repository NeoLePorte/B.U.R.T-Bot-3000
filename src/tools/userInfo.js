async function getUserInfo(userId, client) {
  const user = await client.users.fetch(userId);
  return {
    username: user.username,
    nickname: user.nickname,
    roles: user.roles?.cache.map(role => role.name) || [],
    joinedAt: user.joinedAt,
    isBot: user.bot
  };
}

const definition = {
  name: 'getUserInfo',
  description: 'Get information about a Discord user',
  parameters: {
    type: 'object',
    properties: {
      userId: {
        type: 'string',
        description: 'The Discord user ID to look up'
      }
    },
    required: ['userId']
  }
};

module.exports = { getUserInfo, definition }; 