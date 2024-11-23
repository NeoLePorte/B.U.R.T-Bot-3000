const { GalleryManager } = require('../utils/galleryUtils');

const reactions = {
  name: 'handleReaction',
  description: 'Handle user reactions on messages',
  async execute({ reaction, user }) {
    const gallery = GalleryManager.getGallery(user.id);
    if (!gallery) return;

    const emoji = reaction.emoji.name;
    switch (emoji) {
      case '⬅️':
        if (gallery.currentIndex > 0) {
          gallery.currentIndex--;
          await updateGalleryMessage(reaction.message, gallery);
        }
        break;
      case '➡️':
        if (gallery.currentIndex < gallery.images.length - 1) {
          gallery.currentIndex++;
          await updateGalleryMessage(reaction.message, gallery);
        }
        break;
      case '❌':
        await reaction.message.delete();
        GalleryManager.deleteGallery(user.id);
        break;
    }
  }
};

async function updateGalleryMessage(message, gallery) {
  const currentImage = gallery.images[gallery.currentIndex];
  await message.edit({
    embeds: [{
      title: `Image ${gallery.currentIndex + 1}/${gallery.images.length}`,
      image: { url: currentImage.url }
    }]
  });
}

module.exports = reactions; 