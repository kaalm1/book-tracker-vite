import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db } from '../config/firebase';

export const getUserNotifications = onCall({
  region: 'us-central1',
  memory: '256MiB',
  timeoutSeconds: 30,
}, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'User must be authenticated');
  const { limit = 50, unreadOnly = false } = request.data;
  const userId = request.auth.uid;

  let query = db.collection('notifications')
    .where('userId', '==', userId)
    .orderBy('createdAt', 'desc')
    .limit(limit);

  if (unreadOnly) query = query.where('read', '==', false);

  const snapshot = await query.get();
  const notifications = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  return { notifications };
});
