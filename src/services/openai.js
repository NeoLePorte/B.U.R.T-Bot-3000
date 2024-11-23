const OpenAI = require('openai');

class OpenAIService {
  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.XAI_API_KEY,
      baseURL: "https://api.x.ai/v1",
    });
  }

  async createChatCompletion(options) {
    return await this.client.chat.completions.create(options);
  }
}

// Export a singleton instance
module.exports = new OpenAIService().client; 