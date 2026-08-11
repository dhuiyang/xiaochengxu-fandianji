App({
  globalData: {
    // 云函数请求的云开发环境 ID。
    env: 'cloud1-d5geu37vd9a1c956f',
  },
  onLaunch() {
    // 初始化云开发，以便页面通过 familyKitchen 云函数读写真实数据。
    if (this.globalData.env && wx.cloud) {
      wx.cloud.init({ env: this.globalData.env, traceUser: true });
    }
  },
});
