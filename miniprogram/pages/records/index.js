const api = require('../../utils/api');
Page({
  data: { records: [], isLoading: true, hasLoaded: false },
  async onShow() {
    const requestId = (this.recordsRequestId || 0) + 1;
    this.recordsRequestId = requestId;
    if (!this.data.hasLoaded) this.setData({ isLoading: true });
    try {
      const records = await api.listRecords();
      if (requestId !== this.recordsRequestId) return;
      this.setData({
        records: records.map((item) =>
          Object.assign({}, item, {
            time: item.confirmedAt ? '已确认' : '刚刚',
            mealLabel: item.meal === 'dinner' ? '晚餐' : '午餐',
          })
        ),
        isLoading: false,
        hasLoaded: true,
      });
    } catch (e) {
      if (requestId !== this.recordsRequestId) return;
      this.setData({ isLoading: false });
      wx.showToast({ title: e.message, icon: 'none' });
    }
  },
});
