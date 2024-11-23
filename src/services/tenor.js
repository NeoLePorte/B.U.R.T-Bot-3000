const axios = require('axios');
const config = require('../config/constants');

class TenorService {
  constructor() {
    this.apiKey = config.TENOR_API_KEY;
    this.baseUrl = 'https://tenor.googleapis.com/v2';
  }

  async searchGif(query, limit = 1) {
    try {
      const response = await axios.get(`${this.baseUrl}/search`, {
        params: {
          q: query,
          key: this.apiKey,
          limit
        }
      });
      return response.data.results;
    } catch (error) {
      console.error('Tenor API Error:', error);
      throw error;
    }
  }
}

module.exports = new TenorService(); 