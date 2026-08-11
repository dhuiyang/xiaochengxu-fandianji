const api = require('../../utils/api');
Page({
  data: { records: [] },
  async onShow() {
    try {
      const records = await api.listRecords();
      this.setData({
        records: records.map((item) =>
          Object.assign({}, item, { time: item.confirmedAt ? '已确认' : '刚刚' })
        ),
      });
    } catch (e) {
      wx.showToast({ title: e.message, icon: 'none' });
    }
  },
});
