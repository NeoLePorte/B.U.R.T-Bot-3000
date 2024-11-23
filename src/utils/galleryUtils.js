class GalleryManager {
  constructor() {
    this.galleries = new Map();
  }

  createGallery(userId, images) {
    this.galleries.set(userId, {
      images,
      currentIndex: 0
    });
  }

  getGallery(userId) {
    return this.galleries.get(userId);
  }

  deleteGallery(userId) {
    this.galleries.delete(userId);
  }
}

module.exports = new GalleryManager(); 