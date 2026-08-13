const FUNCTION_NAME = 'familyKitchen';

function call(action, data) {
  return wx.cloud.callFunction({ name: FUNCTION_NAME, data: { action, data } }).then((res) => {
    const result = res.result || {};
    // 正常业务云函数统一返回 { ok, data }。若收到了云函数模板的回显，
    // 说明云端函数尚未部署为本项目的实现，不能误当作成功。
    if (!Object.prototype.hasOwnProperty.call(result, 'ok')) {
      return Promise.reject(new Error(`云函数 ${FUNCTION_NAME} 版本未更新，请部署后重试`));
    }
    if (!result.ok) return Promise.reject(new Error(result.message || '请求失败'));
    return result.data;
  });
}
module.exports = {
  bootstrap: () => call('bootstrap'),
  createFamily: (data) => call('createFamily', data),
  joinFamily: (data) => call('joinFamily', data),
  listMyFamilies: () => call('listMyFamilies'),
  switchFamily: (familyId) => call('switchFamily', { familyId }),
  updateMemberRole: (memberId, role) => call('updateMemberRole', { memberId, role }),
  removeFamilyMember: (memberId) => call('removeFamilyMember', { memberId }),
  updateProfile: (data) => call('updateProfile', data),
  updateFamily: (data) => call('updateFamily', data),
  overview: (context) => call('overview', context),
  recommendDish: (category, context) => call('recommendDish', Object.assign({ category }, context)),
  listDishes: () => call('listDishes'),
  getDish: (id) => call('getDish', { id }),
  saveDish: (data) => call('saveDish', data),
  updateDish: (id, data) => call('updateDish', Object.assign({ id }, data)),
  deleteDish: (id) => call('deleteDish', { id }),
  submitMealRequest: (data) => call('submitMealRequest', data),
  confirmMeal: (data) => call('confirmMeal', data),
  listRecords: () => call('listRecords'),
};
