import { db } from '../config/firebase';
import { SearchResult } from '../types/search';

export async function saveNotifications(userId: string, bookTitle: string, results: SearchResult[]) {
  const batch = db.batch();
  for (const result of results) {
    const ref = db.collection('notifications').doc();
    batch.set(ref, {
      userId,
      bookTitle,
      title: result.title,
      price: result.price,
      source: result.source,
      link: result.link,
      condition: result.condition || null,
      seller: result.seller || null,
      date: new Date().toISOString().split('T')[0],
      read: false,
      createdAt: new Date()
    });
  }
  await batch.commit();
}

export async function markNotificationRead(notificationId: string) {
  await db.collection('notifications').doc(notificationId).update({
    read: true,
    readAt: new Date()
  });
}
