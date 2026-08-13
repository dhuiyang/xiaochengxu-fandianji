const api = require('../../utils/api');
Page({
  data: {
    isConfirm: false,
    categories: ['全部', '荤菜', '素菜', '汤羹', '米饭'],
    activeCategory: '全部',
    dishes: [],
    visibleDishes: [],
    note: '',
    meal: 'lunch',
    mealName: '午餐',
    mealDate: '',
    mealDateLabel: '',
  },
  onLoad(options) {
    const meal = options.meal === 'dinner' ? 'dinner' : 'lunch';
    this.setData({
      isConfirm: options.mode === 'confirm',
      meal,
      mealName: meal === 'dinner' ? '晚餐' : '午餐',
      mealDate: options.date,
      mealDateLabel: this.getDateLabel(options.date),
    });
    this.recommendId = options.recommendId || '';
    wx.setNavigationBarTitle({
      title:
        options.mode === 'confirm'
          ? `确认${meal === 'dinner' ? '晚餐' : '午餐'}菜单`
          : `${meal === 'dinner' ? '晚餐' : '午餐'}点菜`,
    });
    this.load();
  },
  async load() {
    try {
      const context = { date: this.data.mealDate, meal: this.data.meal };
      const [dishes, overview] = await Promise.all([api.listDishes(), api.overview(context)]);
      const mine = overview.requests.find((item) => item.openId === overview.member.openId);
      const chosen =
        this.data.isConfirm && overview.record ? overview.record.dishes : mine ? mine.dishes : [];
      this.setData({
        dishes: dishes.map((item) =>
          Object.assign({}, item, {
            selected: chosen.indexOf(item.name) > -1 || item._id === this.recommendId,
          })
        ),
        note: mine ? mine.note : '',
      });
      if (this.recommendId) wx.showToast({ title: '已为你勾选推荐菜', icon: 'none' });
      this.applyFilter();
    } catch (e) {
      wx.showToast({ title: e.message, icon: 'none' });
    }
  },
  getDateLabel(date) {
    const parts = String(date || '').split('-');
    return parts.length === 3 ? `${Number(parts[1])} 月 ${Number(parts[2])} 日` : '今日';
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
  viewDish(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({ url: `/pages/dish-detail/index?id=${id}` });
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
      const context = { date: this.data.mealDate, meal: this.data.meal };
      if (this.data.isConfirm) await api.confirmMeal(Object.assign({ dishIds }, context));
      else await api.submitMealRequest(Object.assign({ dishIds, note: this.data.note }, context));
      wx.showToast({
        title: this.data.isConfirm ? `${this.data.mealName}菜单已确认` : '已提交给主厨',
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
