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
    mealDate: '',
    mealName: '午餐',
    isTomorrow: false,
    isManualMeal: false,
    mealCountdown: '',
    dateLabel: '',
    userAvatar: '我',
    profileName: '',
    profileAvatarPreview: '',
    showProfileEditor: false,
    editingName: '',
    editingNameFirst: '我',
    editingAvatarFileId: '',
    editingAvatarPreview: '',
    isUploadingProfileAvatar: false,
    isSavingProfile: false,
    isLoading: true,
    showRecommend: false,
    recommendCategory: '全部',
    recommendCategories: ['全部', '荤菜', '素菜', '汤羹'],
    recommendation: null,
    isRecommending: false,
  },
  async onShow() {
    const context = this.updateMealTiming();
    this.startMealTimer();
    try {
      const init = await api.bootstrap();
      if (!init.family) {
        wx.redirectTo({ url: '/pages/onboarding/index' });
        return;
      }
      wx.setNavigationBarTitle({ title: init.family.name || '家庭厨房' });
      await this.loadOverview(context, init.profile);
    } catch (e) {
      this.setData({ isLoading: false });
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
    if (this.data.isManualMeal) return this.getMealContext();
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
      mealDate: this.getDateValue(tomorrow ? target : now),
      mealName,
      isTomorrow: tomorrow,
      mealCountdown: `距离${tomorrow ? '明日' : ''}${mealName}还有${duration}`,
      dateLabel: this.getDateLabel(now),
    });
    return { date: this.getDateValue(tomorrow ? target : now), meal: activeMeal };
  },
  getDateValue(date) {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
  },
  getMealContext() {
    return { date: this.data.mealDate, meal: this.data.activeMeal };
  },
  async loadOverview(context, profile) {
    this.setData({ isLoading: true });
    try {
      const state = await api.overview(context || this.getMealContext());
      const mine = state.requests.find((item) => item.openId === state.member.openId);
      const record = state.record;
      this.setData({
        isChef: ['owner', 'chef'].includes(state.member.role),
        profileName: (profile || state.profile || {}).name || state.member.name,
        userAvatar: this.getAvatarText((profile || state.profile || {}).name || state.member.name),
        profileAvatarPreview: (profile || state.profile || {}).avatarFileId || '',
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
        isLoading: false,
      });
    } catch (e) {
      this.setData({ isLoading: false });
      wx.showToast({ title: e.message, icon: 'none' });
    }
  },
  changeMeal(e) {
    const meal = e.currentTarget.dataset.meal;
    const now = new Date();
    const context = { date: this.getDateValue(now), meal };
    this.setData({
      activeMeal: meal,
      mealDate: context.date,
      mealName: meal === 'dinner' ? '晚餐' : '午餐',
      isTomorrow: false,
      isManualMeal: true,
      mealCountdown: `查看今日${meal === 'dinner' ? '晚餐' : '午餐'}安排`,
    });
    this.loadOverview(context);
  },
  getDateLabel(date) {
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return `${date.getMonth() + 1} 月 ${date.getDate()} 日 · ${weekdays[date.getDay()]}`;
  },
  getAvatarText(nickname) {
    const name = String(nickname || '').trim();
    return Array.from(name)[0] || '我';
  },
  openProfileEditor() {
    this.setData({
      showProfileEditor: true,
      editingName: this.data.profileName,
      editingNameFirst: this.data.userAvatar,
      editingAvatarFileId: this.data.profileAvatarPreview,
      editingAvatarPreview: this.data.profileAvatarPreview,
    });
  },
  closeProfileEditor() {
    if (!this.data.isSavingProfile && !this.data.isUploadingProfileAvatar)
      this.setData({ showProfileEditor: false });
  },
  inputProfileName(e) {
    const name = e.detail.value;
    this.setData({ editingName: name, editingNameFirst: this.getAvatarText(name) });
  },
  async chooseProfileAvatar() {
    if (this.data.isUploadingProfileAvatar) return;
    const previousAvatar = {
      editingAvatarFileId: this.data.editingAvatarFileId,
      editingAvatarPreview: this.data.editingAvatarPreview,
    };
    try {
      const { tempFiles } = await wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: ['album', 'camera'],
      });
      const filePath = tempFiles && tempFiles[0] && tempFiles[0].tempFilePath;
      if (!filePath) return;
      const extension = (filePath.match(/\.[a-zA-Z0-9]+$/) || ['.jpg'])[0].toLowerCase();
      this.setData({ editingAvatarPreview: filePath, isUploadingProfileAvatar: true });
      const result = await wx.cloud.uploadFile({
        cloudPath: `user-avatars/${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 10)}${extension}`,
        filePath,
      });
      this.setData({ editingAvatarFileId: result.fileID, editingAvatarPreview: result.fileID });
    } catch (e) {
      if (!String(e.errMsg || '').includes('cancel')) {
        this.setData(previousAvatar);
        wx.showToast({ title: '头像上传失败，请重试', icon: 'none' });
      }
    } finally {
      this.setData({ isUploadingProfileAvatar: false });
    }
  },
  async saveProfile() {
    if (!this.data.editingName.trim()) {
      wx.showToast({ title: '请填写昵称', icon: 'none' });
      return;
    }
    if (this.data.isUploadingProfileAvatar || this.data.isSavingProfile) return;
    try {
      this.setData({ isSavingProfile: true });
      const profile = await api.updateProfile({
        name: this.data.editingName,
        avatarFileId: this.data.editingAvatarFileId,
      });
      this.setData({
        userAvatar: this.getAvatarText(profile.name),
        profileName: profile.name,
        profileAvatarPreview: profile.avatarFileId,
        showProfileEditor: false,
      });
      wx.showToast({ title: '个人资料已更新', icon: 'success' });
    } catch (e) {
      wx.showToast({ title: e.message, icon: 'none' });
    } finally {
      this.setData({ isSavingProfile: false });
    }
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
    const context = this.getMealContext();
    wx.navigateTo({
      url: `/pages/meal/index?mode=order&meal=${context.meal}&date=${context.date}`,
    });
  },
  openRecommend() {
    this.setData({ showRecommend: true, recommendation: null });
    this.loadRecommendation();
  },
  closeRecommend() {
    this.setData({ showRecommend: false });
  },
  noop() {},
  chooseRecommendCategory(e) {
    this.setData({ recommendCategory: e.currentTarget.dataset.category, recommendation: null });
    this.loadRecommendation();
  },
  async loadRecommendation() {
    if (this.data.isRecommending) return;
    this.setData({ isRecommending: true });
    try {
      const recommendation = await api.recommendDish(
        this.data.recommendCategory,
        this.getMealContext()
      );
      this.setData({ recommendation });
    } catch (e) {
      if (e.message === '请先添加菜品') {
        this.closeRecommend();
        wx.showModal({
          title: '还没有菜品',
          content: '先添加几道家庭菜谱，才能开始随机推荐。',
          confirmText: '去添加',
          success: (result) => {
            if (result.confirm) wx.navigateTo({ url: '/pages/dish-form/index' });
          },
        });
      } else wx.showToast({ title: e.message, icon: 'none' });
    } finally {
      this.setData({ isRecommending: false });
    }
  },
  addRecommendation() {
    const recommendation = this.data.recommendation;
    if (!recommendation || !recommendation.dish) return;
    this.closeRecommend();
    const context = this.getMealContext();
    wx.navigateTo({
      url: `/pages/meal/index?mode=order&recommendId=${recommendation.dish._id}&meal=${context.meal}&date=${context.date}`,
    });
  },
  goConfirm() {
    const context = this.getMealContext();
    wx.navigateTo({
      url: `/pages/meal/index?mode=confirm&meal=${context.meal}&date=${context.date}`,
    });
  },
  goRecipes() {
    wx.switchTab({ url: '/pages/recipes/index' });
  },
  goRecords() {
    wx.switchTab({ url: '/pages/records/index' });
  },
});
