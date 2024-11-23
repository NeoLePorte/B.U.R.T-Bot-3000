const axios = require('axios');

async function searchGif(searchTerm, mood) {
  try {
    console.log('Searching for GIF:', mood, searchTerm, 'reaction');
    
    if (!searchTerm) {
      return {
        gifUrl: null,
        mood: mood,
        searchTerm: searchTerm,
        error: 'No search term provided'
      };
    }

    const query = `${searchTerm} ${mood || ''} reaction`.trim();
    
    const response = await axios.get('https://tenor.googleapis.com/v2/search', {
      params: {
        q: query,
        key: process.env.TENOR_API_KEY,
        client_key: 'burt_bot',
        limit: 20,
        random: true
      }
    });

    if (response.data?.results?.length > 0) {
      const randomIndex = Math.floor(Math.random() * response.data.results.length);
      const gif = response.data.results[randomIndex];
      
      return {
        gifUrl: {
          url: gif.media_formats.gif.url,
          height: gif.media_formats.gif.dims[1],
          width: gif.media_formats.gif.dims[0]
        },
        mood: mood,
        searchTerm: searchTerm
      };
    }
    
    return {
      gifUrl: null,
      mood: mood,
      searchTerm: searchTerm,
      error: 'No GIFs found'
    };

  } catch (error) {
    console.error('Error searching for GIF:', error);
    return {
      gifUrl: null,
      mood: mood,
      searchTerm: searchTerm,
      error: error.message
    };
  }
}

// OpenAI function definition
const definition = {
  name: 'searchGif',
  description: 'Search for and use reaction GIFs',
  parameters: {
    type: 'object',
    properties: {
      searchTerm: {
        type: 'string',
        description: 'The term to search for'
      },
      mood: {
        type: 'string',
        description: 'The mood/emotion of the GIF (e.g., happy, sad, excited)',
        required: false
      }
    },
    required: ['searchTerm']
  }
};

module.exports = { searchGif, definition }; 