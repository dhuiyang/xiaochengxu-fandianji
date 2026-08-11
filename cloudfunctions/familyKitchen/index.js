const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;
const collections = ['users', 'families', 'familyMembers', 'dishes', 'mealRequests', 'mealRecords'];

const today = () => new Date().toISOString().slice(0, 10);
const first = async (query) => (await query.limit(1).get()).data[0];
const ensureCollections = async () => {
  for (const name of collections) {
    try {
      await db.createCollection(name);
    } catch (e) {}
  }
};
const context = () => cloud.getWXContext().OPENID;
async function userContext() {
  const openId = context();
  const user = await first(db.collection('users').where({ openId }));
  if (!user || !user.familyId) return { openId, user: user || null, member: null, family: null };
  const member = await first(
    db.collection('familyMembers').where({ familyId: user.familyId, openId })
  );
  const family = await db.collection('families').doc(user.familyId).get();
  return { openId, user, member, family: family.data };
}
function requireFamily(ctx) {
  if (!ctx.member) throw new Error('请先创建或加入家庭');
  return ctx;
}
async function bootstrap() {
  await ensureCollections();
  const ctx = await userContext();
  return { family: ctx.family, member: ctx.member };
}
async function createFamily({ name, memberName }) {
  await ensureCollections();
  const ctx = await userContext();
  if (ctx.member) throw new Error('你已经加入家庭');
  const inviteCode = Math.random().toString(36).slice(2, 8).toUpperCase();
  const family = await db.collection('families').add({
    data: {
      name: (name || '我的家庭').slice(0, 20),
      inviteCode,
      ownerOpenId: ctx.openId,
      createdAt: db.serverDate(),
    },
  });
  await db.collection('users').where({ openId: ctx.openId }).remove();
  await db.collection('users').add({
    data: {
      openId: ctx.openId,
      familyId: family._id,
      name: (memberName || '我').slice(0, 12),
      createdAt: db.serverDate(),
    },
  });
  await db.collection('familyMembers').add({
    data: {
      familyId: family._id,
      openId: ctx.openId,
      name: (memberName || '我').slice(0, 12),
      role: 'owner',
      createdAt: db.serverDate(),
    },
  });
  return bootstrap();
}
async function joinFamily({ inviteCode, memberName }) {
  await ensureCollections();
  const ctx = await userContext();
  if (ctx.member) throw new Error('你已经加入家庭');
  const family = await first(
    db.collection('families').where({
      inviteCode: String(inviteCode || '')
        .trim()
        .toUpperCase(),
    })
  );
  if (!family) throw new Error('邀请码无效');
  await db.collection('users').where({ openId: ctx.openId }).remove();
  await db.collection('users').add({
    data: {
      openId: ctx.openId,
      familyId: family._id,
      name: (memberName || '家人').slice(0, 12),
      createdAt: db.serverDate(),
    },
  });
  await db.collection('familyMembers').add({
    data: {
      familyId: family._id,
      openId: ctx.openId,
      name: (memberName || '家人').slice(0, 12),
      role: 'member',
      createdAt: db.serverDate(),
    },
  });
  return bootstrap();
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
async function saveDish({ name, category, description, emoji }) {
  const ctx = requireFamily(await userContext());
  if (!name || !String(name).trim()) throw new Error('请填写菜名');
  await db.collection('dishes').add({
    data: {
      familyId: ctx.family._id,
      name: String(name).trim().slice(0, 30),
      category: category || '荤菜',
      description: (description || '').slice(0, 40),
      emoji: emoji || '🍲',
      createdAt: db.serverDate(),
    },
  });
  return { success: true };
}
async function overview() {
  const ctx = requireFamily(await userContext());
  const date = today();
  const [members, requests, record] = await Promise.all([
    db.collection('familyMembers').where({ familyId: ctx.family._id }).limit(20).get(),
    db
      .collection('mealRequests')
      .where({ familyId: ctx.family._id, date, meal: 'lunch' })
      .limit(20)
      .get(),
    first(db.collection('mealRecords').where({ familyId: ctx.family._id, date, meal: 'lunch' })),
  ]);
  return {
    family: ctx.family,
    member: ctx.member,
    members: members.data,
    requests: requests.data,
    record: record || null,
  };
}
async function submitMealRequest({ dishIds, note }) {
  const ctx = requireFamily(await userContext());
  if (!Array.isArray(dishIds) || !dishIds.length) throw new Error('至少选择一道菜');
  const date = today();
  if (
    await first(
      db.collection('mealRecords').where({ familyId: ctx.family._id, date, meal: 'lunch' })
    )
  )
    throw new Error('今日菜单已确认，不能再修改点菜');
  const dishes = (
    await db
      .collection('dishes')
      .where({ familyId: ctx.family._id, _id: _.in(dishIds) })
      .get()
  ).data;
  if (!dishes.length) throw new Error('所选菜品不存在');
  const data = {
    familyId: ctx.family._id,
    openId: ctx.openId,
    memberName: ctx.member.name,
    dishIds: dishes.map((d) => d._id),
    dishes: dishes.map((d) => d.name),
    note: (note || '').trim().slice(0, 60),
    date,
    meal: 'lunch',
    updatedAt: db.serverDate(),
  };
  const existed = await first(
    db
      .collection('mealRequests')
      .where({ familyId: ctx.family._id, openId: ctx.openId, date, meal: 'lunch' })
  );
  if (existed) await db.collection('mealRequests').doc(existed._id).update({ data });
  else await db.collection('mealRequests').add({ data });
  return { success: true };
}
async function confirmMeal({ dishIds }) {
  const ctx = requireFamily(await userContext());
  if (!['owner', 'chef'].includes(ctx.member.role)) throw new Error('只有厨师可以确认菜单');
  if (!Array.isArray(dishIds) || !dishIds.length) throw new Error('至少选择一道菜');
  const dishes = (
    await db
      .collection('dishes')
      .where({ familyId: ctx.family._id, _id: _.in(dishIds) })
      .get()
  ).data;
  const date = today();
  const existed = await first(
    db.collection('mealRecords').where({ familyId: ctx.family._id, date, meal: 'lunch' })
  );
  const data = {
    familyId: ctx.family._id,
    date,
    meal: 'lunch',
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
      listDishes,
      saveDish,
      overview,
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
