const api = require('../../utils/api');
Page({
  data: {
    dishes: [],
    visibleDishes: [],
    categories: ['全部', '荤菜', '素菜', '汤羹'],
    activeCategory: '全部',
    keyword: '',
    isLoading: true,
  },
  async onShow() {
    this.setData({ isLoading: true });
    try {
      const dishes = await api.listDishes();
      this.setData({ dishes, visibleDishes: this.getVisibleDishes(dishes), isLoading: false });
    } catch (e) {
      this.setData({ isLoading: false });
      wx.showToast({ title: e.message, icon: 'none' });
    }
  },
  getVisibleDishes(dishes = this.data.dishes) {
    const keyword = this.data.keyword.trim();
    return dishes.filter(
      (item) =>
        (this.data.activeCategory === '全部' || item.category === this.data.activeCategory) &&
        (!keyword || item.name.indexOf(keyword) > -1)
    );
  },
  apply() {
    const visibleDishes = this.getVisibleDishes();
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
  goEdit(e) {
    wx.navigateTo({ url: `/pages/dish-form/index?id=${e.currentTarget.dataset.id}` });
  },
});
