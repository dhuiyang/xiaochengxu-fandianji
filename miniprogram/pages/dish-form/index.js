const api = require('../../utils/api');
Page({
  data: {
    name: '',
    description: '',
    method: '',
    category: '荤菜',
    categories: ['荤菜', '素菜', '汤羹', '米饭'],
    emoji: '🍲',
    emojis: ['🍲', '🐟', '🍗', '🥩', '🥦', '🍅', '🥬', '🍜'],
    imageFileId: '',
    imagePreview: '',
    isUploadingImage: false,
    dishId: '',
    isEditing: false,
  },
  async onLoad(options) {
    try {
      const context = await api.bootstrap();
      if (!['owner', 'chef'].includes(context.member.role)) {
        wx.showToast({ title: '只有厨师可以管理菜谱', icon: 'none' });
        setTimeout(() => wx.navigateBack(), 300);
        return;
      }
    } catch (e) {
      wx.showToast({ title: e.message, icon: 'none' });
      return;
    }
    if (!options.id) return;
    this.setData({ dishId: options.id, isEditing: true });
    wx.setNavigationBarTitle({ title: '编辑菜谱' });
    try {
      wx.showLoading({ title: '加载中' });
      const dish = await api.getDish(options.id);
      this.setData({
        name: dish.name || '',
        description: dish.description || '',
        method: dish.method || '',
        category: dish.category || '荤菜',
        emoji: dish.emoji || '🍲',
        imageFileId: dish.imageFileId || '',
        imagePreview: dish.imageUrl || '',
      });
    } catch (e) {
      wx.showToast({ title: e.message, icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },
  inputName(e) {
    this.setData({ name: e.detail.value });
  },
  inputDescription(e) {
    this.setData({ description: e.detail.value });
  },
  inputMethod(e) {
    this.setData({ method: e.detail.value });
  },
  pickCategory(e) {
    this.setData({ category: this.data.categories[e.detail.value] });
  },
  chooseEmoji(e) {
    this.setData({ emoji: e.currentTarget.dataset.emoji });
  },
  async chooseImage() {
    if (this.data.isUploadingImage) return;
    const previousImage = {
      imageFileId: this.data.imageFileId,
      imagePreview: this.data.imagePreview,
    };
    try {
      const { tempFiles } = await wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: ['album', 'camera'],
      });
      const tempFilePath = tempFiles && tempFiles[0] && tempFiles[0].tempFilePath;
      if (!tempFilePath) return;
      const extension = (tempFilePath.match(/\.[a-zA-Z0-9]+$/) || ['.jpg'])[0].toLowerCase();
      this.setData({ imagePreview: tempFilePath, isUploadingImage: true });
      const result = await wx.cloud.uploadFile({
        cloudPath: `dish-images/${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 10)}${extension}`,
        filePath: tempFilePath,
      });
      this.setData({ imageFileId: result.fileID });
    } catch (e) {
      if (!String(e.errMsg || '').includes('cancel')) {
        this.setData(previousImage);
        wx.showToast({ title: '图片上传失败，请重试', icon: 'none' });
      }
    } finally {
      this.setData({ isUploadingImage: false });
    }
  },
  removeImage() {
    if (this.data.isUploadingImage) return;
    this.setData({ imageFileId: '', imagePreview: '' });
  },
  async save() {
    if (!this.data.name.trim()) {
      wx.showToast({ title: '请填写菜名', icon: 'none' });
      return;
    }
    if (!this.data.description.trim()) {
      wx.showToast({ title: '请填写菜品简介', icon: 'none' });
      return;
    }
    if (this.data.isUploadingImage) {
      wx.showToast({ title: '图片上传中，请稍候', icon: 'none' });
      return;
    }
    try {
      wx.showLoading({ title: '保存中' });
      const payload = {
        name: this.data.name,
        description: this.data.description,
        method: this.data.method,
        category: this.data.category,
        emoji: this.data.emoji,
        imageFileId: this.data.imageFileId,
      };
      if (this.data.isEditing) await api.updateDish(this.data.dishId, payload);
      else await api.saveDish(payload);
      wx.showToast({
        title: this.data.isEditing ? '菜谱已更新' : '已加入家庭菜谱',
        icon: 'success',
      });
      setTimeout(() => wx.navigateBack(), 500);
    } catch (e) {
      wx.showToast({ title: e.message, icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },
});
