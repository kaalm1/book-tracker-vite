// functions/src/index.ts
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as nodemailer from 'nodemailer';
import axios from 'axios';
import * as cheerio from 'cheerio';
import * as functions from "firebase-functions";
import { onRequest } from 'firebase-functions/v2/https';
// import * as logger from 'firebase-functions/logger';
import { v4 as uuidv4 } from 'uuid';
import snoowrap from 'snoowrap';
import { defineSecret } from 'firebase-functions/params';

const redditClientId = defineSecret('VITE_REDDIT_CLIENT_ID');
const redditClientSecret = defineSecret('VITE_REDDIT_CLIENT_SECRET');
const redditUsername = defineSecret('VITE_REDDIT_USERNAME');
const redditPassword = defineSecret('VITE_REDDIT_PASSWORD');

initializeApp();
const db = getFirestore();

const getTransporter = () => {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: functions.config().gmail.user,
      pass: functions.config().gmail.pass,
    },
  });
};

interface SearchResult {
  id: string;
  title: string;
  price: string;
  source: string;
  condition?: string;
  link: string;
  seller?: string;
}

interface Book {
  id: string;
  title: string;
  author?: string;
  userId: string;
  lastSearched?: string;
}

interface User {
  email: string;
  displayName: string;
  notifications?: boolean;
}

// Scheduled daily book search
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
    const usersSnapshot = await db.collection('users')
      .where('notifications', '==', true)
      .get();

    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data() as User;
      const booksSnapshot = await db.collection('books')
        .where('userId', '==', userDoc.id)
        .get();

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
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (error) {
          console.error(`Error searching for book "${book.title}":`, error);
        }
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  } catch (error) {
    console.error('Error in daily book search:', error);
  }
  console.log('Daily book search completed');
});

// Manual search
export const searchBook = onCall({
  region: 'us-central1',
  memory: '256MiB',
  timeoutSeconds: 60,
  enforceAppCheck: false,
  invoker: 'public',
  secrets: [redditClientId, redditClientSecret, redditUsername, redditPassword],
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

// Mark notification as read
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

// Get user notifications
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

// Reddit search callable
export const searchRedditCallable = onCall({
  secrets: [redditClientId, redditClientSecret, redditUsername, redditPassword]
}, async (request) => {
  const results = await searchReddit(request.data.searchQuery);
  return results;
});

// Cleanup old notifications
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

// Health check
export const healthCheck = onCall({
  region: 'us-central1',
  memory: '128MiB',
  timeoutSeconds: 10,
}, async () => ({
  status: 'healthy',
  timestamp: new Date().toISOString(),
  version: '2.0.0'
}));

export const api = onRequest({
  region: 'us-central1',
  memory: '128MiB',
  timeoutSeconds: 10,
}, (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '2.0.0'
  });
});

// Utility functions
async function searchAllPlatforms(bookTitle: string, author?: string): Promise<SearchResult[]> {
  const searchQuery = author ? `${bookTitle} ${author}` : bookTitle;
  const results = await Promise.all([
    searchCraigslist(searchQuery).catch(() => []),
    searchReddit(searchQuery).catch(() => []),
    searcheBay(searchQuery).catch(() => []),
    searchGoogle(searchQuery).catch(() => []),
  ]);
  return results.flat().filter((r, i, self) => i === self.findIndex(x => x.link === r.link));
}

async function searcheBay(searchQuery: string): Promise<SearchResult[]> {
  const url = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(searchQuery + ' book')}&_sacat=267`;
  const response = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const $ = cheerio.load(response.data);
  const results: SearchResult[] = [];

  $('.s-item').each((i, el) => {
    if (i >= 10 || i === 0) return;

    const $el = $(el);
    const title = $el.find('.s-item__title').text().trim();
    const price = $el.find('.s-item__price').text().trim();
    const link = $el.find('.s-item__link').attr('href');
    const condition = $el.find('.SECONDARY_INFO').text().trim();

    if (title && !title.toLowerCase().includes('shop on ebay')) {
      results.push({
        id: uuidv4(),
        title,
        price: price || 'Price not listed',
        source: 'eBay',
        link: link || '',
        condition: condition || 'Condition not specified'
      });
    }
  });

  return results;
}

async function searchGoogle(searchQuery: string): Promise<SearchResult[]> {
  // Create search terms focused on book sales
  const searchTerms = [
    `"${searchQuery}" book for sale`,
    `"${searchQuery}" used book`,
    `buy "${searchQuery}" book`,
    `"${searchQuery}" paperback hardcover sale`
  ];
  
  const results: SearchResult[] = [];
  
  for (const term of searchTerms) {
    try {
      const encodedQuery = encodeURIComponent(term);
      const url = `https://www.google.com/search?q=${encodedQuery}&tbm=shop`;
      
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive'
        },
        timeout: 10000
      });
      
      const $ = cheerio.load(response.data);
      
      // Google Shopping results
      $('.sh-dgr__content').each((i, el) => {
        if (i >= 8) return; // Limit results per search term
        
        const $el = $(el);
        const title = $el.find('.sh-dgr__title').text().trim() || 
                     $el.find('.Xjkr3b').text().trim() ||
                     $el.find('[data-attrid="title"]').text().trim();
        
        const price = $el.find('.a8Pemb').text().trim() || 
                     $el.find('.kHxwFf').text().trim() ||
                     $el.find('.T14wmb').text().trim();
        
        const link = $el.find('a').first().attr('href');
        const seller = $el.find('.aULzUe').text().trim() ||
                      $el.find('.E5ocAb').text().trim();
        
        if (title && link) {
          // Clean up the link if it's a Google redirect
          let cleanLink = link;
          if (link.includes('/url?')) {
            const urlParams = new URLSearchParams(link.split('?')[1]);
            cleanLink = urlParams.get('url') || urlParams.get('q') || link;
          }
          
          results.push({
            id: uuidv4(),
            title,
            price: price || 'Price not listed',
            source: seller ? `Google Shopping (${seller})` : 'Google Shopping',
            link: cleanLink,
            seller: seller || undefined
          });
        }
      });
      
      // Regular Google search results for book sales
      if (results.length < 5) {
        const regularUrl = `https://www.google.com/search?q=${encodedQuery}`;
        const regularResponse = await axios.get(regularUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          },
          timeout: 10000
        });
        
        const $regular = cheerio.load(regularResponse.data);
        
        $regular('[data-ved]').each((i, el) => {
          if (results.length >= 8) return;
          
          const $el = $regular(el);
          const titleEl = $el.find('h3').first();
          const title = titleEl.text().trim();
          const linkEl = $el.find('a').first();
          const link = linkEl.attr('href');
          const snippet = $el.find('[data-sncf]').text().trim() ||
                         $el.find('.VwiC3b').text().trim();
          
          if (title && link && snippet) {
            const snippetLower = snippet.toLowerCase();
            const titleLower = title.toLowerCase();
            
            // Check if this looks like a book sale listing
            const saleKeywords = ['for sale', 'buy', 'purchase', 'price', '$', 'amazon', 'barnes', 'book', 'paperback', 'hardcover', 'used books'];
            const hasSaleKeywords = saleKeywords.some(keyword => 
              snippetLower.includes(keyword) || titleLower.includes(keyword)
            );
            
            // Extract price from snippet if available
            const priceMatch = snippet.match(/\$(\d+(?:\.\d{2})?)/);
            
            if (hasSaleKeywords && !link.includes('google.com')) {
              let cleanLink = link;
              if (link.startsWith('/url?')) {
                const urlParams = new URLSearchParams(link.substring(5));
                cleanLink = urlParams.get('url') || urlParams.get('q') || link;
              }
              
              // Determine source from domain
              let source = 'Google Search';
              try {
                const domain = new URL(cleanLink).hostname.replace('www.', '');
                if (domain.includes('amazon')) source = 'Amazon';
                else if (domain.includes('barnes')) source = 'Barnes & Noble';
                else if (domain.includes('abebooks')) source = 'AbeBooks';
                else if (domain.includes('alibris')) source = 'Alibris';
                else if (domain.includes('thriftbooks')) source = 'ThriftBooks';
                else source = `Google Search (${domain})`;
              } catch (e) {
                // Keep default source if URL parsing fails
              }
              
              results.push({
                id: uuidv4(),
                title: title.length > 100 ? title.substring(0, 100) + '...' : title,
                price: priceMatch ? `$${priceMatch[1]}` : 'See listing for price',
                source,
                link: cleanLink
              });
            }
          }
        });
      }
      
      // Add delay between search terms to be respectful
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error(`Error searching Google for term "${term}":`, error);
      continue; // Continue with next search term if one fails
    }
  }
  
  // Remove duplicates based on link and limit results
  const uniqueResults = results.filter((r, i, self) =>
    i === self.findIndex(x => x.link === r.link)
  );
  
  return uniqueResults.slice(0, 8); // Return max 8 results
}

async function searchCraigslist(searchQuery: string): Promise<SearchResult[]> {
  const url = `https://craigslist.org/search/sss?query=${encodeURIComponent(searchQuery)}`;
  const response = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const $ = cheerio.load(response.data);
  const results: SearchResult[] = [];

  $('.result-row').each((i, el) => {
    if (i >= 8) return;

    const $el = $(el);
    const title = $el.find('.result-title').text().trim();
    const price = $el.find('.result-price').text().trim();
    const link = $el.find('.result-title').attr('href');
    const location = $el.find('.result-hood').text().trim();
    const titleLower = title.toLowerCase();

    if (titleLower.includes('book') || titleLower.includes('novel') || titleLower.includes('textbook') ||
        searchQuery.split(' ').some(word => titleLower.includes(word.toLowerCase()))) {
      results.push({
        id: uuidv4(),
        title,
        price: price || 'Price not listed',
        source: `Craigslist${location ? ` ${location}` : ''}`,
        link: link?.startsWith('http') ? link : `https://craigslist.org${link}`,
        condition: 'Used'
      });
    }
  });

  return results;
}

async function searchReddit(searchQuery: string, credentials?: {
  clientId: string;
  clientSecret: string;
  username: string;
  password: string;
}): Promise<SearchResult[]> {
  const creds = credentials || {
    clientId: redditClientId.value(),
    clientSecret: redditClientSecret.value(),
    username: redditUsername.value(),
    password: redditPassword.value()
  };

  const reddit = new snoowrap({
    userAgent: 'booktracker/1.0 (by /u/JoTisch)',
    clientId: creds.clientId,
    clientSecret: creds.clientSecret,
    username: creds.username,
    password: creds.password
  });

  const searchTerms = [
    `${searchQuery} for sale`,
    `selling ${searchQuery}`,
    `${searchQuery} book sale`
  ];

  const results: SearchResult[] = [];

  for (const term of searchTerms) {
    const posts = await reddit.search({
      query: term,
      sort: 'new',
      time: 'month',
      limit: 15
    });

    posts.forEach((post: any) => {
      const title = post.title;
      const text = post.selftext || '';
      const combined = (title + ' ' + text).toLowerCase();

      if ((combined.includes('for sale') || combined.includes('selling') || combined.includes('sale')) &&
          !post.over_18 && post.subreddit_type === 'public') {
        const priceMatch = combined.match(/\$(\d+(?:\.\d{2})?)/);
        results.push({
          id: uuidv4(),
          title,
          price: priceMatch ? `$${priceMatch[1]}` : 'See post for price',
          source: `Reddit r/${post.subreddit}`,
          link: `https://reddit.com${post.permalink}`,
          seller: `/u/${post.author}`
        });
      }
    });

    await new Promise(resolve => setTimeout(resolve, 500));
  }

  const uniqueResults = results.filter((r, i, self) =>
    i === self.findIndex(x => x.link === r.link)
  );

  return uniqueResults.slice(0, 5);
}

async function sendEmailToUser(email: string, name: string, bookTitle: string, results: SearchResult[]): Promise<void> {
  const transporter = getTransporter();
  const html = `
    <html>
    <body>
      <h2>📚 Book Found: ${bookTitle}</h2>
      <p>Hello ${name},</p>
      <p>We found ${results.length} listing${results.length !== 1 ? 's' : ''} for "${bookTitle}":</p>
      ${results.map(result => `
        <div>
          <strong>${result.title}</strong><br/>
          Price: ${result.price}<br/>
          Source: ${result.source}${result.seller ? ` • ${result.seller}` : ''}<br/>
          ${result.condition ? `Condition: ${result.condition}<br/>` : ''}
          <a href="${result.link}" target="_blank">View Listing</a>
        </div><br/>
      `).join('')}
      <p>Happy reading! 📖</p>
    </body>
    </html>
  `;

  await transporter.sendMail({
    from: `"Book Tracker 📚" <${functions.config().gmail.user}>`,
    to: email,
    subject: `📚 ${results.length} listing${results.length !== 1 ? 's' : ''} found: ${bookTitle}`,
    html
  });
}

async function saveNotifications(userId: string, bookTitle: string, results: SearchResult[]): Promise<void> {
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
