const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  const notifs = await p.notifications.findMany({ where: { user_id: 14 } });
  console.log('NOTIFS FOR 14:', JSON.stringify(notifs, null, 2));
  await p['$disconnect']();
})();
