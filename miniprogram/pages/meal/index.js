const api = require('../../utils/api');
Page({
  data: {
    isConfirm: false,
    categories: ['全部', '荤菜', '素菜', '汤羹'],
    activeCategory: '全部',
    dishes: [],
    visibleDishes: [],
    note: '',
  },
  onLoad(options) {
    this.setData({ isConfirm: options.mode === 'confirm' });
    wx.setNavigationBarTitle({ title: options.mode === 'confirm' ? '确认菜单' : '我的点菜' });
    this.load();
  },
  async load() {
    try {
      const [dishes, overview] = await Promise.all([api.listDishes(), api.overview()]);
      const mine = overview.requests.find((item) => item.openId === overview.member.openId);
      const chosen =
        this.data.isConfirm && overview.record ? overview.record.dishes : mine ? mine.dishes : [];
      this.setData({
        dishes: dishes.map((item) =>
          Object.assign({}, item, { selected: chosen.indexOf(item.name) > -1 })
        ),
        note: mine ? mine.note : '',
      });
      this.applyFilter();
    } catch (e) {
      wx.showToast({ title: e.message, icon: 'none' });
    }
  },
  applyFilter() {
    const list =
      this.data.activeCategory === '全部'
        ? this.data.dishes
        : this.data.dishes.filter((item) => item.category === this.data.activeCategory);
    this.setData({ visibleDishes: list });
  },
  filterCategory(e) {
    this.setData({ activeCategory: e.currentTarget.dataset.category });
    this.applyFilter();
  },
  toggleDish(e) {
    const id = e.currentTarget.dataset.id;
    const dishes = this.data.dishes.map((item) =>
      item._id === id ? Object.assign({}, item, { selected: !item.selected }) : item
    );
    this.setData({ dishes });
    this.applyFilter();
  },
  onNoteInput(e) {
    this.setData({ note: e.detail.value });
  },
  async submit() {
    const dishIds = this.data.dishes.filter((item) => item.selected).map((item) => item._id);
    if (!dishIds.length) {
      wx.showToast({ title: '至少选择一道菜', icon: 'none' });
      return;
    }
    try {
      wx.showLoading({ title: '提交中' });
      if (this.data.isConfirm) await api.confirmMeal({ dishIds });
      else await api.submitMealRequest({ dishIds, note: this.data.note });
      wx.showToast({
        title: this.data.isConfirm ? '今日菜单已确认' : '已提交给主厨',
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
