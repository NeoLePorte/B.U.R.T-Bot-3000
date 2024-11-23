const tenorService = require('../services/tenor');

const searchGif = {
  name: 'searchGif',
  description: 'Search for GIFs using Tenor',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query for GIFs'
      },
      limit: {
        type: 'number',
        description: 'Number of GIFs to return'
      }
    },
    required: ['query']
  },
  async execute({ query, limit = 1 }) {
    const results = await tenorService.searchGif(query, limit);
    return results.map(gif => ({
      url: gif.media_formats.gif.url,
      preview: gif.media_formats.tinygif.url,
      title: gif.title
    }));
  }
};

module.exports = searchGif; 