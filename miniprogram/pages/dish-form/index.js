const api = require('../../utils/api');
Page({
  data: {
    name: '',
    description: '',
    category: '荤菜',
    categories: ['荤菜', '素菜', '汤羹'],
    emoji: '🍲',
    emojis: ['🍲', '🐟', '🍗', '🥩', '🥦', '🍅', '🥬', '🍜'],
  },
  inputName(e) {
    this.setData({ name: e.detail.value });
  },
  inputDescription(e) {
    this.setData({ description: e.detail.value });
  },
  pickCategory(e) {
    this.setData({ category: this.data.categories[e.detail.value] });
  },
  chooseEmoji(e) {
    this.setData({ emoji: e.currentTarget.dataset.emoji });
  },
  async save() {
    if (!this.data.name.trim()) {
      wx.showToast({ title: '请填写菜名', icon: 'none' });
      return;
    }
    try {
      wx.showLoading({ title: '保存中' });
      await api.saveDish(this.data);
      wx.showToast({ title: '已加入家庭菜谱', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 500);
    } catch (e) {
      wx.showToast({ title: e.message, icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },
});
