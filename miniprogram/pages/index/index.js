const api = require('../../utils/api');
Page({
  data: {
    isChef: false,
    myOrderText: '还没点菜',
    myNote: '',
    confirmed: false,
    confirmedText: '',
    familyRequestCount: 0,
    requests: [],
    activeMeal: 'lunch',
    mealCountdown: '',
    dateLabel: '',
    userAvatar: '我',
  },
  async onShow() {
    this.updateMealTiming();
    this.startMealTimer();
    try {
      const init = await api.bootstrap();
      if (!init.family) {
        wx.redirectTo({ url: '/pages/onboarding/index' });
        return;
      }
      wx.setNavigationBarTitle({ title: init.family.name || '家庭厨房' });
      const state = await api.overview();
      const mine = state.requests.find((item) => item.openId === state.member.openId);
      const record = state.record;
      this.setData({
        isChef: ['owner', 'chef'].includes(state.member.role),
        userAvatar: this.getAvatarText(state.member.name),
        myOrderText: mine ? mine.dishes.join('、') : '还没点菜',
        myNote: mine ? mine.note : '',
        requests: state.requests
          .filter((item) => item.openId !== state.member.openId)
          .map((item) =>
            Object.assign({}, item, { avatar: item.memberName.slice(0, 1), name: item.memberName })
          ),
        confirmed: !!record,
        confirmedText: record ? record.dishes.join('、') : '',
        familyRequestCount: state.requests.length,
      });
    } catch (e) {
      wx.showToast({ title: e.message, icon: 'none' });
    }
  },
  onHide() {
    this.stopMealTimer();
  },
  onUnload() {
    this.stopMealTimer();
  },
  updateMealTiming() {
    const now = new Date();
    const lunch = new Date(now);
    lunch.setHours(12, 0, 0, 0);
    const dinner = new Date(now);
    dinner.setHours(18, 0, 0, 0);
    let activeMeal = 'lunch';
    let target = lunch;
    let mealName = '午餐';
    let tomorrow = false;

    if (now >= lunch && now < dinner) {
      activeMeal = 'dinner';
      target = dinner;
      mealName = '晚餐';
    } else if (now >= dinner) {
      target = new Date(lunch);
      target.setDate(target.getDate() + 1);
      tomorrow = true;
    }

    const totalMinutes = Math.max(0, Math.ceil((target.getTime() - now.getTime()) / 60000));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const duration = hours ? `${hours}小时${minutes ? `${minutes}分` : ''}` : `${minutes}分`;
    this.setData({
      activeMeal,
      mealCountdown: `距离${tomorrow ? '明日' : ''}${mealName}还有${duration}`,
      dateLabel: this.getDateLabel(now),
    });
  },
  getDateLabel(date) {
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return `${date.getMonth() + 1} 月 ${date.getDate()} 日 · ${weekdays[date.getDay()]}`;
  },
  getAvatarText(nickname) {
    const name = String(nickname || '').trim();
    return Array.from(name)[0] || '我';
  },
  startMealTimer() {
    this.stopMealTimer();
    this.mealTimer = setInterval(() => this.updateMealTiming(), 60000);
  },
  stopMealTimer() {
    if (!this.mealTimer) return;
    clearInterval(this.mealTimer);
    this.mealTimer = null;
  },
  goOrder() {
    wx.navigateTo({ url: '/pages/meal/index?mode=order' });
  },
  goConfirm() {
    wx.navigateTo({ url: '/pages/meal/index?mode=confirm' });
  },
  goRecipes() {
    wx.switchTab({ url: '/pages/recipes/index' });
  },
  goRecords() {
    wx.switchTab({ url: '/pages/records/index' });
  },
});
