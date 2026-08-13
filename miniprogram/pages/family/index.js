const api = require('../../utils/api');
Page({
  data: {
    family: {},
    members: [],
    families: [],
    isLoading: true,
    isOwner: false,
    showRoleManager: false,
    selectedMember: null,
    selectedRole: 'member',
    isSavingRole: false,
    showFamilyEditor: false,
    editingFamilyName: '',
    editingFamilyDescription: '',
    editingFamilyAvatarFileId: '',
    editingFamilyAvatarPreview: '',
    isUploadingFamilyAvatar: false,
    isSavingFamily: false,
  },
  async onShow() {
    this.setData({ isLoading: true });
    try {
      const now = new Date();
      const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
        now.getDate()
      ).padStart(2, '0')}`;
      const [data, families] = await Promise.all([
        api.overview({ date, meal: 'lunch' }),
        api.listMyFamilies(),
      ]);
      this.setData({
        family: data.family,
        families,
        isOwner: data.member.role === 'owner',
        members: data.members.map((item) =>
          Object.assign({}, item, {
            avatar: item.name.slice(0, 1),
            isSelf: item.openId === data.member.openId,
            roleLabel:
              item.role === 'owner' ? '家庭主理人' : item.role === 'chef' ? '厨师' : '家庭成员',
            roleDescription:
              item.role === 'owner'
                ? '管理家庭和确认菜单'
                : item.role === 'chef'
                ? '可以确认午餐和晚餐菜单'
                : '可以点菜和查看家庭菜谱',
          })
        ),
        isLoading: false,
      });
    } catch (e) {
      this.setData({ isLoading: false });
      wx.showToast({ title: e.message, icon: 'none' });
    }
  },
  openRoleManager(e) {
    const member = this.data.members.find((item) => item._id === e.currentTarget.dataset.id);
    if (!member || member.isSelf || member.role === 'owner' || !this.data.isOwner) return;
    this.setData({ showRoleManager: true, selectedMember: member, selectedRole: member.role });
  },
  openFamilyEditor() {
    if (!this.data.isOwner) return;
    this.setData({
      showFamilyEditor: true,
      editingFamilyName: this.data.family.name || '',
      editingFamilyDescription: this.data.family.description || '',
      editingFamilyAvatarFileId: this.data.family.avatarFileId || '',
      editingFamilyAvatarPreview: this.data.family.avatarFileId || '',
    });
  },
  closeFamilyEditor() {
    if (!this.data.isSavingFamily && !this.data.isUploadingFamilyAvatar)
      this.setData({ showFamilyEditor: false });
  },
  inputFamilyName(e) {
    this.setData({ editingFamilyName: e.detail.value });
  },
  inputFamilyDescription(e) {
    this.setData({ editingFamilyDescription: e.detail.value });
  },
  async chooseFamilyAvatar() {
    if (this.data.isUploadingFamilyAvatar) return;
    const previousAvatar = {
      editingFamilyAvatarFileId: this.data.editingFamilyAvatarFileId,
      editingFamilyAvatarPreview: this.data.editingFamilyAvatarPreview,
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
      this.setData({ editingFamilyAvatarPreview: filePath, isUploadingFamilyAvatar: true });
      const result = await wx.cloud.uploadFile({
        cloudPath: `family-avatars/${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 10)}${extension}`,
        filePath,
      });
      this.setData({
        editingFamilyAvatarFileId: result.fileID,
        editingFamilyAvatarPreview: result.fileID,
      });
    } catch (e) {
      if (!String(e.errMsg || '').includes('cancel')) {
        this.setData(previousAvatar);
        wx.showToast({ title: '头像上传失败，请重试', icon: 'none' });
      }
    } finally {
      this.setData({ isUploadingFamilyAvatar: false });
    }
  },
  async saveFamily() {
    if (!this.data.editingFamilyName.trim()) {
      wx.showToast({ title: '请填写家庭名称', icon: 'none' });
      return;
    }
    if (this.data.isUploadingFamilyAvatar || this.data.isSavingFamily) return;
    try {
      this.setData({ isSavingFamily: true });
      const family = await api.updateFamily({
        name: this.data.editingFamilyName,
        description: this.data.editingFamilyDescription,
        avatarFileId: this.data.editingFamilyAvatarFileId,
      });
      this.setData({
        family: Object.assign({}, this.data.family, family),
        showFamilyEditor: false,
      });
      wx.setNavigationBarTitle({ title: family.name || '家庭厨房' });
      wx.showToast({ title: '家庭信息已更新', icon: 'success' });
    } catch (e) {
      wx.showToast({ title: e.message, icon: 'none' });
    } finally {
      this.setData({ isSavingFamily: false });
    }
  },
  closeRoleManager() {
    if (!this.data.isSavingRole) this.setData({ showRoleManager: false });
  },
  noop() {},
  chooseRole(e) {
    this.setData({ selectedRole: e.currentTarget.dataset.role });
  },
  async saveRole() {
    const member = this.data.selectedMember;
    if (!member || this.data.isSavingRole) return;
    if (member.role === this.data.selectedRole) {
      this.closeRoleManager();
      return;
    }
    try {
      this.setData({ isSavingRole: true });
      await api.updateMemberRole(member._id, this.data.selectedRole);
      wx.showToast({
        title: `已将${member.name}设为${this.data.selectedRole === 'chef' ? '厨师' : '家庭成员'}`,
        icon: 'none',
      });
      this.setData({ showRoleManager: false });
      await this.onShow();
    } catch (e) {
      wx.showToast({ title: e.message, icon: 'none' });
    } finally {
      this.setData({ isSavingRole: false });
    }
  },
  confirmRemoveMember() {
    const member = this.data.selectedMember;
    if (!member || this.data.isSavingRole || !this.data.isOwner) return;
    wx.showModal({
      title: '移除家庭成员',
      content: `确定移除“${member.name}”吗？对方将无法再访问当前家庭，历史点菜和饮食记录会保留。`,
      confirmText: '移除',
      confirmColor: '#d96829',
      success: async (result) => {
        if (!result.confirm) return;
        try {
          this.setData({ isSavingRole: true });
          await api.removeFamilyMember(member._id);
          this.setData({ showRoleManager: false });
          wx.showToast({ title: '成员已移除', icon: 'success' });
          await this.onShow();
        } catch (e) {
          wx.showToast({ title: e.message, icon: 'none' });
        } finally {
          this.setData({ isSavingRole: false });
        }
      },
    });
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
