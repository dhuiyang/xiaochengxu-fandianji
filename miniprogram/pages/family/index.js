const api = require('../../utils/api');
Page({
  data: { family: {}, members: [], families: [], isLoading: true },
  async onShow() {
    this.setData({ isLoading: true });
    try {
      const [data, families] = await Promise.all([api.overview(), api.listMyFamilies()]);
      this.setData({
        family: data.family,
        families,
        members: data.members.map((item) =>
          Object.assign({}, item, { avatar: item.name.slice(0, 1) })
        ),
        isLoading: false,
      });
    } catch (e) {
      this.setData({ isLoading: false });
      wx.showToast({ title: e.message, icon: 'none' });
    }
  },
  showFamilySwitcher() {
    const families = this.data.families;
    const currentFamilyId = this.data.family._id;
    const itemList = families.map((item) => (item.active ? `${item.name}（当前）` : item.name));
    itemList.push('加入或创建家庭');
    wx.showActionSheet({
      itemList,
      success: async (result) => {
        if (result.tapIndex === families.length) {
          wx.navigateTo({ url: '/pages/onboarding/index?allowExisting=1' });
          return;
        }
        const selected = families[result.tapIndex];
        if (!selected || selected.familyId === currentFamilyId) return;
        try {
          wx.showLoading({ title: '切换中' });
          await api.switchFamily(selected.familyId);
          wx.showToast({ title: '已切换家庭', icon: 'success' });
          await this.onShow();
        } catch (e) {
          wx.showToast({ title: e.message, icon: 'none' });
        } finally {
          wx.hideLoading();
        }
      },
    });
  },
  copyCode() {
    wx.setClipboardData({
      data: this.data.family.inviteCode,
      success() {
        wx.showToast({ title: '邀请码已复制' });
      },
    });
  },
});
