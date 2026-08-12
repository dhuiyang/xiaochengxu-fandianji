const api = require('../../utils/api');
Page({
  data: {
    name: '',
    description: '',
    category: '荤菜',
    categories: ['荤菜', '素菜', '汤羹'],
    emoji: '🍲',
    emojis: ['🍲', '🐟', '🍗', '🥩', '🥦', '🍅', '🥬', '🍜'],
    dishId: '',
    isEditing: false,
  },
  async onLoad(options) {
    if (!options.id) return;
    this.setData({ dishId: options.id, isEditing: true });
    wx.setNavigationBarTitle({ title: '编辑菜谱' });
    try {
      wx.showLoading({ title: '加载中' });
      const dish = await api.getDish(options.id);
      this.setData({
        name: dish.name || '',
        description: dish.description || '',
        category: dish.category || '荤菜',
        emoji: dish.emoji || '🍲',
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
      const payload = {
        name: this.data.name,
        description: this.data.description,
        category: this.data.category,
        emoji: this.data.emoji,
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
