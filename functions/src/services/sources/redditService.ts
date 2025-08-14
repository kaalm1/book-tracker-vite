import { v4 as uuidv4 } from 'uuid';
import { SearchResult } from '../../types/search';
import { defineSecret } from 'firebase-functions/params';
import snoowrap from 'snoowrap';


export const redditClientId = defineSecret('VITE_REDDIT_CLIENT_ID');
export const redditClientSecret = defineSecret('VITE_REDDIT_CLIENT_SECRET');
export const redditUsername = defineSecret('VITE_REDDIT_USERNAME');
export const redditPassword = defineSecret('VITE_REDDIT_PASSWORD');


export async function searchReddit(searchQuery: string, credentials?: {
    clientId: string;
    clientSecret: string;
    username: string;
    password: string;
  }): Promise<SearchResult[]> {
    const creds = credentials || {
      clientId: redditClientId.value()?.trim(),
      clientSecret: redditClientSecret.value()?.trim(),
      username: redditUsername.value()?.trim(),
      password: redditPassword.value()?.trim()
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
  