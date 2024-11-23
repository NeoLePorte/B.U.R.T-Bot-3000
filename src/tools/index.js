const { searchGif, definition: searchGifDef } = require('./gifTool');
const { webSearch, definition: webSearchDef } = require('./webSearch');
const { getUserInfo, definition: userInfoDef } = require('./userInfo');
const { getRecentMessages, definition: messagesDef } = require('./messageTools');
const { getChannelInfo, definition: channelInfoDef } = require('./channelInfo');
const { searchTweets, definition: tweetsDef } = require('./searchTweets');
const { analyzeContent, definition: analyzeDefinition } = require('./analyzeTools');
const { analyzeImage, definition: visionDef } = require('./visionTool');

// Define the available functions for OpenAI
const functions = [
  {
    type: "function",
    function: userInfoDef
  },
  {
    type: "function",
    function: messagesDef
  },
  {
    type: "function",
    function: channelInfoDef
  },
  {
    type: "function",
    function: searchGifDef
  },
  {
    type: "function",
    function: webSearchDef
  },
  {
    type: "function",
    function: tweetsDef
  },
  {
    type: "function",
    function: analyzeDefinition
  },
  {
    type: "function",
    function: visionDef
  }
];

// Export all tool functions individually
module.exports = {
  // Tool Functions
  searchGif,
  webSearch,
  getUserInfo,
  getRecentMessages,
  getChannelInfo,
  searchTweets,
  analyzeContent,
  analyzeImage,
  
  // Tool Definitions for OpenAI
  functions,
  
  // Tool Execution Helper
  executeToolCall: async (name, args, message) => {
    switch(name) {
      case 'searchGif':
        return await searchGif(args.searchTerm, args.mood);
      case 'webSearch':
        return await webSearch(args.query, args.limit);
      case 'getUserInfo':
        return await getUserInfo(args.userId, message.client);
      case 'getRecentMessages':
        return await getRecentMessages(message.channel, args.limit);
      case 'getChannelInfo':
        return await getChannelInfo(message.channel);
      case 'searchTweets':
        return await searchTweets(args.limit, args.sort_order);
      case 'analyzeContent':
        return await analyzeContent(message, args.content);
      case 'analyze_image':
        return await analyzeImage(args.images, args.query);
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }
}; 