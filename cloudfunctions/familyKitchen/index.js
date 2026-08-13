const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;
const MAX_DISHES_PER_MEAL = 20;
const DISH_CATEGORIES = ['荤菜', '素菜', '汤羹', '米饭'];

// 所有餐次日期按中国标准时间（Asia/Shanghai）计算，不能用 UTC 日期替代本地业务日。
const shanghaiDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const formatDate = (date) => {
  const parts = shanghaiDateFormatter.formatToParts(date);
  const value = (type) => parts.find((part) => part.type === type).value;
  return `${value('year')}-${value('month')}-${value('day')}`;
};
const today = () => formatDate(new Date());
const nextDate = () => {
  const now = new Date();
  return formatDate(new Date(now.getTime() + 24 * 60 * 60 * 1000));
};
const mealLabel = (meal) => (meal === 'dinner' ? '晚餐' : '午餐');
function resolveMealContext({ date, meal }) {
  const safeMeal = meal === 'dinner' ? 'dinner' : meal === 'lunch' ? 'lunch' : null;
  const safeDate = String(date || '');
  if (!safeMeal || ![today(), nextDate()].includes(safeDate))
    throw new Error('餐次时间无效，请返回首页重新选择');
  if (safeDate === nextDate() && safeMeal !== 'lunch') throw new Error('目前仅支持安排明日午餐');
  return { date: safeDate, meal: safeMeal };
}
const first = async (query) => (await query.limit(1).get()).data[0];
const context = () => {
  const openId = cloud.getWXContext().OPENID;
  if (!openId) throw new Error('登录状态失效，请重新进入小程序');
  return openId;
};
const normalizeDishIds = (dishIds) => {
  if (!Array.isArray(dishIds) || !dishIds.length) throw new Error('至少选择一道菜');
  const ids = [...new Set(dishIds.filter((id) => typeof id === 'string' && id))];
  if (!ids.length || ids.length > MAX_DISHES_PER_MEAL || ids.length !== dishIds.length)
    throw new Error('菜品选择无效');
  return ids;
};
const normalizeCategory = (category) => (DISH_CATEGORIES.includes(category) ? category : '荤菜');
const normalizeText = (value, maxLength, fallback = '') =>
  String(value || fallback)
    .trim()
    .slice(0, maxLength);
const normalizeCloudImageFileId = (value, folder) => {
  const fileId = String(value || '').trim();
  if (!fileId) return '';
  if (!fileId.startsWith('cloud://') || !fileId.includes(`/${folder}/`))
    throw new Error('图片无效，请重新上传');
  return fileId.slice(0, 500);
};
const normalizeImageFileId = (value) => normalizeCloudImageFileId(value, 'dish-images');
const removeCloudImage = async (fileId, folder) => {
  if (!fileId || !String(fileId).startsWith('cloud://') || !String(fileId).includes(`/${folder}/`))
    return;
  try {
    await cloud.deleteFile({ fileList: [fileId] });
  } catch {}
};
async function findOwnedDishes(ctx, dishIds) {
  const dishes = (
    await db
      .collection('dishes')
      .where({ familyId: ctx.family._id, _id: _.in(dishIds) })
      .get()
  ).data;
  if (dishes.length !== dishIds.length) throw new Error('所选菜品不存在或不属于当前家庭');
  return dishes;
}
async function setActiveFamily(openId, familyId, name) {
  const user = await first(db.collection('users').where({ openId }));
  const data = {
    openId,
    familyId,
    activeFamilyId: familyId,
    name: name || (user && user.name) || '家人',
    updatedAt: db.serverDate(),
  };
  if (user) await db.collection('users').doc(user._id).update({ data });
  else
    await db
      .collection('users')
      .add({ data: Object.assign({}, data, { createdAt: db.serverDate() }) });
}
async function userContext() {
  const openId = context();
  const user = await first(db.collection('users').where({ openId }));
  let familyId = user && (user.activeFamilyId || user.familyId);
  let member = familyId
    ? await first(db.collection('familyMembers').where({ familyId, openId }))
    : null;
  if (!member) {
    member = await first(db.collection('familyMembers').where({ openId }));
    familyId = member && member.familyId;
    if (familyId) await setActiveFamily(openId, familyId, member.name);
  }
  if (!member || !familyId) return { openId, user: user || null, member: null, family: null };
  const family = await db.collection('families').doc(familyId).get();
  if (!family.data) return { openId, user: user || null, member: null, family: null };
  return { openId, user, member, family: family.data };
}
function requireFamily(ctx) {
  if (!ctx.member || !ctx.family) throw new Error('请先创建或加入家庭');
  return ctx;
}
function requireCook(ctx) {
  if (!['owner', 'chef'].includes(ctx.member.role)) throw new Error('只有厨师可以管理菜谱');
  return ctx;
}
async function bootstrap() {
  const ctx = await userContext();
  return {
    family: ctx.family,
    member: ctx.member,
    profile: ctx.user
      ? {
          name: ctx.user.name || ctx.member?.name || '家人',
          avatarFileId: ctx.user.avatarFileId || '',
        }
      : null,
  };
}
async function createFamily({ name, memberName }) {
  const ctx = await userContext();
  const inviteCode = Math.random().toString(36).slice(2, 8).toUpperCase();
  const family = await db.collection('families').add({
    data: {
      name: normalizeText(name, 20, '我的家庭'),
      inviteCode,
      ownerOpenId: ctx.openId,
      createdAt: db.serverDate(),
    },
  });
  const memberNameValue = normalizeText(memberName, 12, '我');
  await db.collection('familyMembers').add({
    data: {
      familyId: family._id,
      openId: ctx.openId,
      name: memberNameValue,
      role: 'owner',
      createdAt: db.serverDate(),
    },
  });
  await setActiveFamily(ctx.openId, family._id, memberNameValue);
  return bootstrap();
}
async function joinFamily({ inviteCode, memberName }) {
  const ctx = await userContext();
  const family = await first(
    db.collection('families').where({
      inviteCode: String(inviteCode || '')
        .trim()
        .toUpperCase(),
    })
  );
  if (!family) throw new Error('邀请码无效');
  const existed = await first(
    db.collection('familyMembers').where({ familyId: family._id, openId: ctx.openId })
  );
  if (existed) {
    await setActiveFamily(ctx.openId, family._id, existed.name);
    return bootstrap();
  }
  const memberNameValue = normalizeText(memberName, 12, '家人');
  await db.collection('familyMembers').add({
    data: {
      familyId: family._id,
      openId: ctx.openId,
      name: memberNameValue,
      role: 'member',
      createdAt: db.serverDate(),
    },
  });
  await setActiveFamily(ctx.openId, family._id, memberNameValue);
  return bootstrap();
}
async function listMyFamilies() {
  const openId = context();
  const memberships = (await db.collection('familyMembers').where({ openId }).limit(20).get()).data;
  const families = await Promise.all(
    memberships.map(async (member) => {
      const family = await db.collection('families').doc(member.familyId).get();
      return family.data
        ? {
            familyId: member.familyId,
            name: family.data.name,
            role: member.role,
            memberName: member.name,
          }
        : null;
    })
  );
  const ctx = await userContext();
  return families
    .filter(Boolean)
    .map((item) =>
      Object.assign({}, item, { active: !!ctx.family && item.familyId === ctx.family._id })
    );
}
async function switchFamily({ familyId }) {
  const openId = context();
  if (!familyId) throw new Error('请选择家庭');
  const member = await first(db.collection('familyMembers').where({ familyId, openId }));
  if (!member) throw new Error('你未加入该家庭');
  await setActiveFamily(openId, familyId, member.name);
  return bootstrap();
}
async function updateMemberRole({ memberId, role }) {
  const ctx = requireFamily(await userContext());
  if (ctx.member.role !== 'owner') throw new Error('只有家庭主理人可以管理角色');
  if (!memberId) throw new Error('请选择家庭成员');
  if (!['member', 'chef'].includes(role)) throw new Error('角色设置无效');
  const target = await db.collection('familyMembers').doc(memberId).get();
  if (!target.data || target.data.familyId !== ctx.family._id) throw new Error('家庭成员不存在');
  if (target.data.openId === ctx.openId || target.data.role === 'owner')
    throw new Error('不能修改家庭主理人的角色');
  await db
    .collection('familyMembers')
    .doc(memberId)
    .update({
      data: { role, updatedAt: db.serverDate(), updatedBy: ctx.openId },
    });
  return { memberId, role };
}
async function removeFamilyMember({ memberId }) {
  const ctx = requireFamily(await userContext());
  if (ctx.member.role !== 'owner') throw new Error('只有家庭主理人可以移除成员');
  if (!memberId) throw new Error('请选择家庭成员');
  const target = await db.collection('familyMembers').doc(memberId).get();
  if (!target.data || target.data.familyId !== ctx.family._id) throw new Error('家庭成员不存在');
  if (target.data.openId === ctx.openId || target.data.role === 'owner')
    throw new Error('不能移除家庭主理人');
  await db.collection('familyMembers').doc(memberId).remove();
  return { memberId };
}
async function listDishes() {
  const ctx = requireFamily(await userContext());
  return (
    await db
      .collection('dishes')
      .where({ familyId: ctx.family._id })
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get()
  ).data;
}
async function getDish({ id }) {
  const ctx = requireFamily(await userContext());
  if (!id) throw new Error('菜谱不存在');
  const dish = await db.collection('dishes').doc(id).get();
  if (!dish.data || dish.data.familyId !== ctx.family._id) throw new Error('菜谱不存在');
  return dish.data;
}
async function saveDish({ name, category, description, method, emoji, imageFileId }) {
  const ctx = requireCook(await userContext());
  const safeName = normalizeText(name, 30);
  if (!safeName) throw new Error('请填写菜名');
  const safeDescription = normalizeText(description, 80);
  if (!safeDescription) throw new Error('请填写菜品简介');
  await db.collection('dishes').add({
    data: {
      familyId: ctx.family._id,
      name: safeName,
      category: normalizeCategory(category),
      description: safeDescription,
      method: normalizeText(method, 300),
      emoji: emoji || '🍲',
      imageFileId: normalizeImageFileId(imageFileId),
      createdAt: db.serverDate(),
    },
  });
  return { success: true };
}
async function updateDish({ id, name, category, description, method, emoji, imageFileId }) {
  const ctx = requireCook(await userContext());
  if (!id) throw new Error('菜谱不存在');
  const safeName = normalizeText(name, 30);
  if (!safeName) throw new Error('请填写菜名');
  const safeDescription = normalizeText(description, 80);
  if (!safeDescription) throw new Error('请填写菜品简介');
  const dish = await db.collection('dishes').doc(id).get();
  if (!dish.data || dish.data.familyId !== ctx.family._id) throw new Error('菜谱不存在');
  const safeImageFileId = normalizeImageFileId(imageFileId);
  await db
    .collection('dishes')
    .doc(id)
    .update({
      data: {
        name: safeName,
        category: normalizeCategory(category),
        description: safeDescription,
        method: normalizeText(method, 300),
        emoji: emoji || '🍲',
        imageFileId: safeImageFileId,
        updatedAt: db.serverDate(),
      },
    });
  if (dish.data.imageFileId && dish.data.imageFileId !== safeImageFileId)
    await removeCloudImage(dish.data.imageFileId, 'dish-images');
  return { success: true };
}
async function deleteDish({ id }) {
  const ctx = requireCook(await userContext());
  if (!id) throw new Error('菜谱不存在');
  const dish = await db.collection('dishes').doc(id).get();
  if (!dish.data || dish.data.familyId !== ctx.family._id) throw new Error('菜谱不存在');
  const [requests, records] = await Promise.all([
    first(db.collection('mealRequests').where({ familyId: ctx.family._id, dishIds: _.in([id]) })),
    first(db.collection('mealRecords').where({ familyId: ctx.family._id, dishIds: _.in([id]) })),
  ]);
  if (requests || records) throw new Error('该菜已进入点菜或饮食记录，无法删除');
  await db.collection('dishes').doc(id).remove();
  await removeCloudImage(dish.data.imageFileId, 'dish-images');
  return { success: true };
}
async function updateProfile({ name, avatarFileId }) {
  const ctx = requireFamily(await userContext());
  const safeName = normalizeText(name, 12);
  if (!safeName) throw new Error('请填写昵称');
  const safeAvatarFileId = normalizeCloudImageFileId(avatarFileId, 'user-avatars');
  const previousAvatarFileId = (ctx.user && ctx.user.avatarFileId) || '';
  const userData = {
    openId: ctx.openId,
    name: safeName,
    avatarFileId: safeAvatarFileId,
    familyId: ctx.family._id,
    activeFamilyId: ctx.family._id,
    updatedAt: db.serverDate(),
  };
  if (ctx.user) await db.collection('users').doc(ctx.user._id).update({ data: userData });
  else
    await db
      .collection('users')
      .add({ data: Object.assign({}, userData, { createdAt: db.serverDate() }) });
  await db
    .collection('familyMembers')
    .where({ openId: ctx.openId })
    .update({
      data: { name: safeName, updatedAt: db.serverDate() },
    });
  if (previousAvatarFileId && previousAvatarFileId !== safeAvatarFileId)
    await removeCloudImage(previousAvatarFileId, 'user-avatars');
  return { name: safeName, avatarFileId: safeAvatarFileId };
}
async function updateFamily({ name, description, avatarFileId }) {
  const ctx = requireFamily(await userContext());
  if (ctx.member.role !== 'owner') throw new Error('只有家庭主理人可以修改家庭信息');
  const safeName = normalizeText(name, 20);
  if (!safeName) throw new Error('请填写家庭名称');
  const safeDescription = normalizeText(description, 60);
  const safeAvatarFileId = normalizeCloudImageFileId(avatarFileId, 'family-avatars');
  const previousAvatarFileId = ctx.family.avatarFileId || '';
  await db
    .collection('families')
    .doc(ctx.family._id)
    .update({
      data: {
        name: safeName,
        description: safeDescription,
        avatarFileId: safeAvatarFileId,
        updatedAt: db.serverDate(),
        updatedBy: ctx.openId,
      },
    });
  if (previousAvatarFileId && previousAvatarFileId !== safeAvatarFileId)
    await removeCloudImage(previousAvatarFileId, 'family-avatars');
  return { name: safeName, description: safeDescription, avatarFileId: safeAvatarFileId };
}
async function overview(input) {
  const ctx = requireFamily(await userContext());
  const { date, meal } = resolveMealContext(input);
  const [members, requests, record] = await Promise.all([
    db.collection('familyMembers').where({ familyId: ctx.family._id }).limit(20).get(),
    db.collection('mealRequests').where({ familyId: ctx.family._id, date, meal }).limit(20).get(),
    first(db.collection('mealRecords').where({ familyId: ctx.family._id, date, meal })),
  ]);
  const memberOpenIds = members.data.map((member) => member.openId).filter(Boolean);
  const profiles = memberOpenIds.length
    ? (
        await db
          .collection('users')
          .where({ openId: _.in(memberOpenIds) })
          .limit(20)
          .get()
      ).data
    : [];
  const avatarByOpenId = profiles.reduce((result, profile) => {
    result[profile.openId] = profile.avatarFileId || '';
    return result;
  }, {});
  return {
    family: ctx.family,
    member: ctx.member,
    profile: ctx.user
      ? { name: ctx.user.name || ctx.member.name, avatarFileId: ctx.user.avatarFileId || '' }
      : null,
    members: members.data.map((member) =>
      Object.assign({}, member, { avatarFileId: avatarByOpenId[member.openId] || '' })
    ),
    requests: requests.data,
    record: record || null,
  };
}
async function recommendDish({ category, date, meal }) {
  const ctx = requireFamily(await userContext());
  ({ date, meal } = resolveMealContext({ date, meal }));
  const [dishesResult, requestsResult, recordsResult] = await Promise.all([
    db.collection('dishes').where({ familyId: ctx.family._id }).limit(100).get(),
    db.collection('mealRequests').where({ familyId: ctx.family._id, date, meal }).limit(20).get(),
    db
      .collection('mealRecords')
      .where({ familyId: ctx.family._id })
      .orderBy('confirmedAt', 'desc')
      .limit(7)
      .get(),
  ]);
  const allDishes = dishesResult.data.filter(
    (dish) => !category || category === '全部' || dish.category === category
  );
  if (!allDishes.length)
    throw new Error(category && category !== '全部' ? '该分类还没有菜品' : '请先添加菜品');

  const todayDishIds = new Set(
    requestsResult.data.reduce((ids, request) => ids.concat(request.dishIds || []), [])
  );
  const recentDishIds = new Set(
    recordsResult.data.reduce((ids, record) => ids.concat(record.dishIds || []), [])
  );
  const notChosenToday = allDishes.filter((dish) => !todayDishIds.has(dish._id));
  const freshDishes = notChosenToday.filter((dish) => !recentDishIds.has(dish._id));
  const candidates = freshDishes.length
    ? freshDishes
    : notChosenToday.length
    ? notChosenToday
    : allDishes;
  const dish = candidates[Math.floor(Math.random() * candidates.length)];
  return {
    dish,
    reason: freshDishes.length
      ? '避开了本餐已点和最近吃过的菜'
      : notChosenToday.length
      ? '已避开本餐大家点过的菜'
      : '菜谱选择不多，换个口味试试吧',
  };
}
async function submitMealRequest({ dishIds, note, date, meal }) {
  const ctx = requireFamily(await userContext());
  dishIds = normalizeDishIds(dishIds);
  ({ date, meal } = resolveMealContext({ date, meal }));
  if (await first(db.collection('mealRecords').where({ familyId: ctx.family._id, date, meal })))
    throw new Error(`${mealLabel(meal)}菜单已确认，不能再修改点菜`);
  const dishes = await findOwnedDishes(ctx, dishIds);
  const data = {
    familyId: ctx.family._id,
    openId: ctx.openId,
    memberName: ctx.member.name,
    dishIds: dishes.map((d) => d._id),
    dishes: dishes.map((d) => d.name),
    note: normalizeText(note, 60),
    date,
    meal,
    updatedAt: db.serverDate(),
  };
  const existed = await first(
    db
      .collection('mealRequests')
      .where({ familyId: ctx.family._id, openId: ctx.openId, date, meal })
  );
  if (existed) await db.collection('mealRequests').doc(existed._id).update({ data });
  else await db.collection('mealRequests').add({ data });
  return { success: true };
}
async function confirmMeal({ dishIds, date, meal }) {
  const ctx = requireFamily(await userContext());
  if (!['owner', 'chef'].includes(ctx.member.role)) throw new Error('只有厨师可以确认菜单');
  dishIds = normalizeDishIds(dishIds);
  const dishes = await findOwnedDishes(ctx, dishIds);
  ({ date, meal } = resolveMealContext({ date, meal }));
  const existed = await first(
    db.collection('mealRecords').where({ familyId: ctx.family._id, date, meal })
  );
  const data = {
    familyId: ctx.family._id,
    date,
    meal,
    dishIds: dishes.map((d) => d._id),
    dishes: dishes.map((d) => d.name),
    confirmer: ctx.member.name,
    confirmedAt: db.serverDate(),
  };
  if (existed) await db.collection('mealRecords').doc(existed._id).update({ data });
  else await db.collection('mealRecords').add({ data });
  return { success: true };
}
async function listRecords() {
  const ctx = requireFamily(await userContext());
  return (
    await db
      .collection('mealRecords')
      .where({ familyId: ctx.family._id })
      .orderBy('date', 'desc')
      .limit(100)
      .get()
  ).data;
}
exports.main = async (event) => {
  try {
    const handlers = {
      bootstrap,
      createFamily,
      joinFamily,
      listMyFamilies,
      switchFamily,
      updateMemberRole,
      removeFamilyMember,
      updateProfile,
      updateFamily,
      listDishes,
      getDish,
      saveDish,
      updateDish,
      deleteDish,
      overview,
      recommendDish,
      submitMealRequest,
      confirmMeal,
      listRecords,
    };
    if (!handlers[event.action]) throw new Error('未知操作');
    return { ok: true, data: await handlers[event.action](event.data || {}) };
  } catch (error) {
    return { ok: false, message: error.message || '服务暂时不可用' };
  }
};
