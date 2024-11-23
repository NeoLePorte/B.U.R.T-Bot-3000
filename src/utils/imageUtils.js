const { encode } = require('base64-arraybuffer');

async function getImageContext(message) {
  const imageAttachments = message.attachments.filter(att => 
    att.contentType?.startsWith('image/'));
  
  if (imageAttachments.size === 0) return null;

  const imageContexts = await Promise.all(imageAttachments.map(async (attachment) => {
    const response = await fetch(attachment.url);
    const arrayBuffer = await response.arrayBuffer();
    const base64Image = encode(arrayBuffer);
    return `data:${attachment.contentType};base64,${base64Image}`;
  }));

  return imageContexts;
}

module.exports = { getImageContext }; 