const api = require('../../utils/api');
Page({
  data: { step: 'choice', mode: 'create', memberName: '', familyName: '', inviteCode: '' },
  onLoad(options) {
    this.allowExisting = options.allowExisting === '1';
  },
  async onShow() {
    // onboarding 是小程序的入口页。已加入家庭的用户不应在刷新后再次看到创建页。
    if (this.redirecting || this.allowExisting) return;
    try {
      const { family } = await api.bootstrap();
      if (family) {
        this.redirecting = true;
        wx.switchTab({ url: '/pages/index/index' });
      }
    } catch (e) {
      // 云函数暂不可用时留在 onboarding，仍可向用户展示创建/加入入口。
    }
  },
  chooseMode(e) {
    this.setData({ mode: e.currentTarget.dataset.mode, step: 'form' });
  },
  backToChoice() {
    this.setData({ step: 'choice' });
  },
  inputName(e) {
    this.setData({ memberName: e.detail.value });
  },
  inputFamily(e) {
    this.setData({ familyName: e.detail.value });
  },
  inputCode(e) {
    this.setData({ inviteCode: e.detail.value.toUpperCase() });
  },
  async submit() {
    if (!this.data.memberName.trim()) {
      wx.showToast({ title: '请填写你的称呼', icon: 'none' });
      return;
    }
    try {
      wx.showLoading({ title: '保存中' });
      if (this.data.mode === 'create')
        await api.createFamily({
          memberName: this.data.memberName,
          name: this.data.familyName,
        });
      else
        await api.joinFamily({
          memberName: this.data.memberName,
          inviteCode: this.data.inviteCode,
        });
      wx.switchTab({ url: '/pages/index/index' });
    } catch (e) {
      wx.showToast({ title: e.message, icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },
});
