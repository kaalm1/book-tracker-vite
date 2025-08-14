import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db } from '../config/firebase';

export const markNotificationRead = onCall({
  region: 'us-central1',
  memory: '256MiB',
  timeoutSeconds: 30,
}, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'User must be authenticated');
  const { notificationId } = request.data;
  if (!notificationId) throw new HttpsError('invalid-argument', 'Notification ID is required');

  await db.collection('notifications').doc(notificationId).update({
    read: true,
    readAt: new Date()
  });
  return { success: true };
});
