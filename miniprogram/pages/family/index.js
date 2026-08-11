const api = require('../../utils/api');
Page({
  data: { family: {}, members: [] },
  async onShow() {
    try {
      const data = await api.overview();
      this.setData({
        family: data.family,
        members: data.members.map((item) =>
          Object.assign({}, item, { avatar: item.name.slice(0, 1) })
        ),
      });
    } catch (e) {
      wx.showToast({ title: e.message, icon: 'none' });
    }
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
