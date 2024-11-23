const axios = require('axios');

async function webSearch(query, limit = 5) {
  const response = await axios.get('https://api.duckduckgo.com/', {
    params: {
      q: query,
      format: 'json'
    }
  });
  return response.data.RelatedTopics.slice(0, limit);
}

const definition = {
  name: 'webSearch',
  description: 'Search the web for information',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The search query'
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results (default: 5)',
        required: false
      }
    },
    required: ['query']
  }
};

module.exports = { webSearch, definition }; 