const api = require('../../utils/api');
Page({
  data: {
    dishes: [],
    visibleDishes: [],
    categories: ['全部', '荤菜', '素菜', '汤羹'],
    activeCategory: '全部',
    keyword: '',
  },
  async onShow() {
    try {
      const dishes = await api.listDishes();
      this.setData({ dishes });
      this.apply();
    } catch (e) {
      wx.showToast({ title: e.message, icon: 'none' });
    }
  },
  apply() {
    const keyword = this.data.keyword.trim();
    const visibleDishes = this.data.dishes.filter(
      (item) =>
        (this.data.activeCategory === '全部' || item.category === this.data.activeCategory) &&
        (!keyword || item.name.indexOf(keyword) > -1)
    );
    this.setData({ visibleDishes });
  },
  search(e) {
    this.setData({ keyword: e.detail.value });
    this.apply();
  },
  filter(e) {
    this.setData({ activeCategory: e.currentTarget.dataset.category });
    this.apply();
  },
  goAdd() {
    wx.navigateTo({ url: '/pages/dish-form/index' });
  },
});
