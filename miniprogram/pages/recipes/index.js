const api = require('../../utils/api');
Page({
  data: {
    dishes: [],
    visibleDishes: [],
    categories: ['全部', '荤菜', '素菜', '汤羹', '米饭'],
    activeCategory: '全部',
    keyword: '',
    isLoading: true,
    hasLoaded: false,
    canManage: false,
  },
  async onShow() {
    const requestId = (this.recipesRequestId || 0) + 1;
    this.recipesRequestId = requestId;
    if (!this.data.hasLoaded) this.setData({ isLoading: true });
    try {
      const [dishes, context] = await Promise.all([api.listDishes(), api.bootstrap()]);
      if (requestId !== this.recipesRequestId) return;
      this.setData({
        dishes,
        visibleDishes: this.getVisibleDishes(dishes),
        canManage: ['owner', 'chef'].includes(context.member.role),
        isLoading: false,
        hasLoaded: true,
      });
    } catch (e) {
      if (requestId !== this.recipesRequestId) return;
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
    if (!this.data.canManage) return;
    wx.navigateTo({ url: '/pages/dish-form/index' });
  },
  goEdit(e) {
    if (!this.data.canManage) return;
    wx.navigateTo({ url: `/pages/dish-form/index?id=${e.currentTarget.dataset.id}` });
  },
  async deleteDish(e) {
    const id = e.currentTarget.dataset.id;
    const dish = this.data.dishes.find((item) => item._id === id);
    if (!dish) return;
    wx.showModal({
      title: '删除菜谱',
      content: `确定删除“${dish.name}”吗？删除后无法恢复。`,
      confirmColor: '#d96829',
      success: async (result) => {
        if (!result.confirm) return;
        try {
          wx.showLoading({ title: '删除中' });
          await api.deleteDish(id);
          wx.showToast({ title: '菜谱已删除', icon: 'success' });
          await this.onShow();
        } catch (error) {
          wx.showToast({ title: error.message, icon: 'none' });
        } finally {
          wx.hideLoading();
        }
      },
    });
  },
});
