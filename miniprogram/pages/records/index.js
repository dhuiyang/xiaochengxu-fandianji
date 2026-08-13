const api = require('../../utils/api');
Page({
  data: { records: [], isLoading: true },
  async onShow() {
    this.setData({ isLoading: true });
    try {
      const records = await api.listRecords();
      this.setData({
        records: records.map((item) =>
          Object.assign({}, item, {
            time: item.confirmedAt ? '已确认' : '刚刚',
            mealLabel: item.meal === 'dinner' ? '晚餐' : '午餐',
          })
        ),
        isLoading: false,
      });
    } catch (e) {
      this.setData({ isLoading: false });
      wx.showToast({ title: e.message, icon: 'none' });
    }
  },
});
