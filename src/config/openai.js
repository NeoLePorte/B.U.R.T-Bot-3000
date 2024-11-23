const OpenAI = require("openai");

if (!process.env.XAI_API_KEY) {
  console.error('XAI_API_KEY is not set in environment variables');
  process.exit(1);
}

const openai = new OpenAI({
  apiKey: process.env.XAI_API_KEY,
  baseURL: "https://api.x.ai/v1",
});

module.exports = openai; 