import { onSchedule } from 'firebase-functions/v2/scheduler';
import { db } from '../config/firebase';


export const cleanupOldNotifications = onSchedule({
  schedule: '0 2 * * 0',
  timeZone: 'America/New_York',
  region: 'us-central1',
  memory: '256MiB',
  timeoutSeconds: 300,
}, async () => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const oldNotifications = await db.collection('notifications')
    .where('createdAt', '<', thirtyDaysAgo)
    .limit(500)
    .get();

  if (!oldNotifications.empty) {
    const batch = db.batch();
    oldNotifications.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
  }
});
