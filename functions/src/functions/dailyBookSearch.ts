import { onSchedule } from 'firebase-functions/v2/scheduler';
import { db } from '../config/firebase';
import { searchAllPlatforms } from '../services/searchService';
import { sendEmailToUser } from '../services/emailService';
import { saveNotifications } from '../services/notificationService';
import { Book } from '../types/book';
import { User } from '../types/user';
import { delay } from '../utils/delay';
import { redditClientId, redditClientSecret, redditUsername, redditPassword } from '../services/sources/redditService';


export const dailyBookSearch = onSchedule({
  schedule: '0 9 1 * *',
  timeZone: 'America/New_York',
  region: 'us-central1',
  memory: '512MiB',
  timeoutSeconds: 540,
  secrets: [redditClientId, redditClientSecret, redditUsername, redditPassword],
}, async () => {
  console.log('Starting daily book search...');
  try {
    const usersSnapshot = await db.collection('users').where('notifications', '==', true).get();

    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data() as User;
      const booksSnapshot = await db.collection('books').where('userId', '==', userDoc.id).get();

      for (const bookDoc of booksSnapshot.docs) {
        const book = { id: bookDoc.id, ...bookDoc.data() } as Book;
        const lastSearched = book.lastSearched ? new Date(book.lastSearched) : null;
        const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);

        if (lastSearched && lastSearched > sixHoursAgo) continue;

        try {
          const results = await searchAllPlatforms(book.title, book.author);
          if (results.length > 0) {
            await sendEmailToUser(userData.email, userData.displayName, book.title, results);
            await saveNotifications(userDoc.id, book.title, results);
          }
          await bookDoc.ref.update({ lastSearched: new Date().toISOString() });
          await delay(2000);
        } catch (error) {
          console.error(`Error searching for book "${book.title}":`, error);
        }
      }
      await delay(1000);
    }
  } catch (error) {
    console.error('Error in daily book search:', error);
  }
  console.log('Daily book search completed');
});
