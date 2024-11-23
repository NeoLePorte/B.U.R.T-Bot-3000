const axios = require('axios');
const config = require('../config/constants');

async function searchTweets(limit = 5, sort_order = 'recency') {
  const response = await axios.get('https://api.twitter.com/2/tweets/search/recent', {
    headers: {
      'Authorization': `Bearer ${config.TWITTER_BEARER_TOKEN}`
    },
    params: {
      query: '#fishtanklive',
      'max_results': limit,
      'tweet.fields': 'created_at,author_id'
    }
  });
  return response.data.data;
}

const definition = {
  name: 'searchTweets',
  description: 'Search for recent #fishtanklive tweets',
  parameters: {
    type: 'object',
    properties: {
      limit: {
        type: 'number',
        description: 'Maximum number of tweets to return (default: 5)',
        required: false
      },
      sort_order: {
        type: 'string',
        description: 'Sort order (recency or relevancy)',
        required: false
      }
    }
  }
};

module.exports = { searchTweets, definition }; 