const api = require('../../utils/api');

Page({
  data: {
    dish: null,
    isLoading: true,
  },
  async onLoad(options) {
    if (!options.id) {
      wx.showToast({ title: '菜品不存在', icon: 'none' });
      return;
    }
    try {
      const dish = await api.getDish(options.id);
      this.setData({ dish, isLoading: false });
      wx.setNavigationBarTitle({ title: dish.name || '菜品详情' });
    } catch (e) {
      this.setData({ isLoading: false });
      wx.showToast({ title: e.message, icon: 'none' });
    }
  },
});
