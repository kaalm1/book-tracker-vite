import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { searchAllPlatforms } from '../services/searchService';
import { redditClientId, redditClientSecret, redditUsername, redditPassword } from '../services/sources/redditService';
import {googleApiKey, googleSearchEngineId} from '../services/sources/googleApiService';


export const searchBook = onCall({
  region: 'us-central1',
  memory: '256MiB',
  timeoutSeconds: 60,
  enforceAppCheck: false,
  invoker: 'public',
  secrets: [redditClientId, redditClientSecret, redditUsername, redditPassword, googleApiKey, googleSearchEngineId],
}, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Authentication required');
  const { bookTitle, author } = request.data;
  if (!bookTitle) throw new HttpsError('invalid-argument', 'Book title is required');

  try {
    const results = await searchAllPlatforms(bookTitle, author);
    return { results, searchedAt: new Date().toISOString() };
  } catch (error) {
    throw new HttpsError('internal', 'Search failed');
  }
});