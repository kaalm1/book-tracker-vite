import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { defineSecret } from 'firebase-functions/params';
import { db } from '../../config/firebase';
import { SearchResult } from '../../types/search';

// Define secrets for API credentials
export const googleApiKey = defineSecret('VITE_GOOGLE_CUSTOM_SEARCH_API_KEY');
export const googleSearchEngineId = defineSecret('VITE_GOOGLE_CUSTOM_SEARCH_ENGINE_ID');

interface GoogleSearchItem {
  title: string;
  link: string;
  snippet: string;
  displayLink: string;
  pagemap?: {
    product?: Array<{
      name?: string;
      price?: string;
      availability?: string;
      brand?: string;
    }>;
    offer?: Array<{
      price?: string;
      pricecurrency?: string;
    }>;
    metatags?: Array<{
      [key: string]: string;
    }>;
  };
}

interface GoogleSearchResponse {
  items?: GoogleSearchItem[];
  searchInformation?: {
    totalResults: string;
    searchTime: number;
  };
  queries?: {
    request?: Array<{
      totalResults: string;
      searchTerms: string;
    }>;
  };
}

interface DailyQuotaDoc {
  date: string; // YYYY-MM-DD format
  queryCount: number;
  lastUpdated: FirebaseFirestore.Timestamp;
}

// Constants
const MAX_DAILY_QUERIES = 90;
const QUOTA_COLLECTION = 'google_api_quota';

/**
 * Get current date in YYYY-MM-DD format (local timezone)
 */
function getCurrentDateString(): string {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

/**
 * Check and update daily quota usage
 * Returns true if quota allows the request, false if exceeded
 */
async function checkAndUpdateQuota(requestedQueries: number = 1): Promise<boolean> {
  const currentDate = getCurrentDateString();
  const quotaDocRef = db.collection(QUOTA_COLLECTION).doc(currentDate);
  
  try {
    return await db.runTransaction(async (transaction) => {
      const quotaDoc = await transaction.get(quotaDocRef);
      
      let currentCount = 0;
      if (quotaDoc.exists) {
        const data = quotaDoc.data() as DailyQuotaDoc;
        currentCount = data.queryCount || 0;
      }
      
      // Check if adding requested queries would exceed the limit
      if (currentCount + requestedQueries > MAX_DAILY_QUERIES) {
        console.warn(`Daily quota would be exceeded. Current: ${currentCount}, Requested: ${requestedQueries}, Limit: ${MAX_DAILY_QUERIES}`);
        return false;
      }
      
      // Update the quota
      const newCount = currentCount + requestedQueries;
      const quotaData: DailyQuotaDoc = {
        date: currentDate,
        queryCount: newCount,
        lastUpdated: new Date() as any // Firestore will convert this to Timestamp
      };
      
      transaction.set(quotaDocRef, quotaData, { merge: true });
      
      console.log(`Quota updated. Used ${newCount}/${MAX_DAILY_QUERIES} queries for ${currentDate}`);
      return true;
    });
  } catch (error) {
    console.error('Error checking/updating quota:', error);
    // In case of error, allow the request but log it
    return true;
  }
}

/**
 * Get current quota usage for today
 */
async function getCurrentQuotaUsage(): Promise<{ used: number; remaining: number; date: string }> {
  const currentDate = getCurrentDateString();
  const quotaDocRef = db.collection(QUOTA_COLLECTION).doc(currentDate);
  
  try {
    const quotaDoc = await quotaDocRef.get();
    const used = quotaDoc.exists ? (quotaDoc.data() as DailyQuotaDoc).queryCount || 0 : 0;
    
    return {
      used,
      remaining: MAX_DAILY_QUERIES - used,
      date: currentDate
    };
  } catch (error) {
    console.error('Error getting quota usage:', error);
    return {
      used: 0,
      remaining: MAX_DAILY_QUERIES,
      date: currentDate
    };
  }
}

/**
 * Clean up old quota documents (optional maintenance function)
 * Removes quota documents older than 30 days
 */
async function cleanupOldQuotaDocuments(): Promise<void> {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoffDate = thirtyDaysAgo.toISOString().split('T')[0];
    
    const oldDocsQuery = db.collection(QUOTA_COLLECTION).where('date', '<', cutoffDate);
    const oldDocs = await oldDocsQuery.get();
    
    const batch = db.batch();
    oldDocs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    if (!oldDocs.empty) {
      await batch.commit();
      console.log(`Cleaned up ${oldDocs.size} old quota documents`);
    }
  } catch (error) {
    console.error('Error cleaning up old quota documents:', error);
  }
}

async function searchGoogleApi(searchQuery: string, credentials?: {
    apiKey: string;
    searchEngineId: string;
  }): Promise<SearchResult[]> {

  const creds = credentials || {
      apiKey: googleApiKey.value()?.trim(),
      searchEngineId: googleSearchEngineId.value()?.trim(),
    };
  const results: SearchResult[] = [];
  
  // Multiple search strategies for better coverage
  const searchStrategies = [
    {
      query: `"${searchQuery}" book buy purchase`,
      description: 'Direct book purchase search'
    },
    {
      query: `${searchQuery} book for sale used new`,
      description: 'Book for sale search'
    },
    {
      query: `${searchQuery} paperback hardcover price`,
      description: 'Format-specific search'
    }
  ];

  // Check current quota before starting
  const quotaInfo = await getCurrentQuotaUsage();
  console.log(`Current quota usage: ${quotaInfo.used}/${MAX_DAILY_QUERIES} for ${quotaInfo.date}`);
  
  if (quotaInfo.remaining <= 0) {
    console.error('Daily quota exceeded. No searches will be performed.');
    throw new Error(`Daily Google API quota exceeded. Used ${quotaInfo.used}/${MAX_DAILY_QUERIES} queries for ${quotaInfo.date}. Quota resets at midnight.`);
  }

  // Limit strategies based on remaining quota
  const availableStrategies = searchStrategies.slice(0, Math.min(searchStrategies.length, quotaInfo.remaining));
  
  if (availableStrategies.length < searchStrategies.length) {
    console.warn(`Limiting search strategies due to quota. Using ${availableStrategies.length} of ${searchStrategies.length} strategies.`);
  }

  for (const strategy of availableStrategies) {
    try {
      // Check quota before each request
      const canMakeRequest = await checkAndUpdateQuota(1);
      if (!canMakeRequest) {
        console.warn(`Quota exceeded, stopping search after ${results.length} strategies`);
        break;
      }

      const response = await axios.get<GoogleSearchResponse>(
        'https://customsearch.googleapis.com/customsearch/v1',
        {
          params: {
            key: creds.apiKey,
            cx: creds.searchEngineId,
            q: strategy.query,
            num: 10, // Number of results to return (max 10)
            start: 1,
            safe: 'medium',
            fields: 'items(title,link,snippet,displayLink,pagemap),searchInformation'
          },
          timeout: 10000
        }
      );

      if (response.data.items) {
        for (const item of response.data.items) {
          const processedResult = processSearchItem(item, searchQuery);
          if (processedResult) {
            results.push(processedResult);
          }
        }
      }

      // Rate limiting - add delay between requests
      await new Promise(resolve => setTimeout(resolve, 200));
      
    } catch (error) {
      console.error(`Error in search strategy "${strategy.description}":`, error);
      
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 429) {
          console.error('Rate limit exceeded. Consider upgrading your Google API plan.');
          break; // Stop searching if rate limited
        } else if (error.response?.status === 403) {
          console.error('API quota exceeded or invalid credentials.');
          break;
        }
      }
      
      continue; // Continue with next strategy on other errors
    }
  }

  // Log final quota usage
  const finalQuotaInfo = await getCurrentQuotaUsage();
  console.log(`Search completed. Final quota usage: ${finalQuotaInfo.used}/${MAX_DAILY_QUERIES} for ${finalQuotaInfo.date}`);

  // Remove duplicates and filter for book-related results
  const uniqueResults = results.filter((result, index, self) =>
    index === self.findIndex(r => r.link === result.link)
  );

  // Sort by relevance (prioritize known book retailers)
  const sortedResults = uniqueResults.sort((a, b) => {
    const aScore = getRelevanceScore(a);
    const bScore = getRelevanceScore(b);
    return bScore - aScore;
  });

  return sortedResults.slice(0, 8); // Return top 8 results
}

function processSearchItem(item: GoogleSearchItem, originalQuery: string): SearchResult | null {
  const title = item.title;
  const link = item.link;
  const snippet = item.snippet;
  const domain = item.displayLink;

  // Filter out non-book related results
  if (!isBookRelated(title, snippet, domain, originalQuery)) {
    return null;
  }

  // Extract price information
  const price = extractPrice(item);
  
  // Determine source and seller
  const source = determineSource(domain, item);
  
  // Extract condition if available
  const condition = extractCondition(snippet, item);
  
  // Extract seller information
  const seller = extractSeller(item, domain);

  return {
    id: uuidv4(),
    title: cleanTitle(title),
    price: price || 'See listing for price',
    source,
    link,
    condition,
    seller
  };
}

function isBookRelated(title: string, snippet: string, domain: string, originalQuery: string): boolean {
  const titleLower = title.toLowerCase();
  const snippetLower = snippet.toLowerCase();
  const domainLower = domain.toLowerCase();
  
  // Known book retailers
  const bookRetailers = [
    'amazon', 'barnes', 'abebooks', 'alibris', 'thriftbooks', 
    'bookdepository', 'waterstones', 'powells', 'strand'
  ];
  
  // Book-related keywords
  const bookKeywords = [
    'book', 'paperback', 'hardcover', 'novel', 'textbook', 
    'bestseller', 'author', 'isbn', 'edition', 'publisher'
  ];
  
  // Sale-related keywords
  const saleKeywords = [
    'buy', 'purchase', 'price', 'sale', 'shop', 'order', 
    'available', 'stock', 'shipping', '$'
  ];

  // Check if domain is a known book retailer
  if (bookRetailers.some(retailer => domainLower.includes(retailer))) {
    return true;
  }

  // Check if title or snippet contains book-related terms
  const hasBookKeywords = bookKeywords.some(keyword => 
    titleLower.includes(keyword) || snippetLower.includes(keyword)
  );

  // Check if title or snippet contains sale-related terms
  const hasSaleKeywords = saleKeywords.some(keyword => 
    titleLower.includes(keyword) || snippetLower.includes(keyword)
  );

  // Check if original query terms appear in title or snippet
  const queryWords = originalQuery.toLowerCase().split(' ');
  const hasQueryMatch = queryWords.some(word => 
    word.length > 2 && (titleLower.includes(word) || snippetLower.includes(word))
  );

  return hasBookKeywords && (hasSaleKeywords || hasQueryMatch);
}

function extractPrice(item: GoogleSearchItem): string | null {
  // Try to extract from structured data first
  if (item.pagemap?.product) {
    for (const product of item.pagemap.product) {
      if (product.price) {
        return formatPrice(product.price);
      }
    }
  }

  if (item.pagemap?.offer) {
    for (const offer of item.pagemap.offer) {
      if (offer.price) {
        const currency = offer.pricecurrency || '$';
        return `${currency}${offer.price}`;
      }
    }
  }

  // Extract from snippet using regex
  const snippet = item.snippet;
  const pricePatterns = [
    /\$(\d{1,4}(?:\.\d{2})?)/,  // $12.99
    /USD?\s*(\d{1,4}(?:\.\d{2})?)/i,  // USD 12.99
    /Price:\s*\$?(\d{1,4}(?:\.\d{2})?)/i,  // Price: $12.99
    /(\d{1,4}(?:\.\d{2})?)\s*USD/i  // 12.99 USD
  ];

  for (const pattern of pricePatterns) {
    const match = snippet.match(pattern);
    if (match) {
      return `$${match[1]}`;
    }
  }

  return null;
}

function formatPrice(price: string): string {
  // Clean and format price string
  const cleanPrice = price.replace(/[^\d.]/g, '');
  const numPrice = parseFloat(cleanPrice);
  
  if (isNaN(numPrice)) {
    return price;
  }
  
  return `$${numPrice.toFixed(2)}`;
}

function determineSource(domain: string, item: GoogleSearchItem): string {
  const domainLower = domain.toLowerCase();
  
  // Map known domains to friendly names
  const domainMap: { [key: string]: string } = {
    'amazon': 'Amazon',
    'barnesandnoble': 'Barnes & Noble',
    'bn.com': 'Barnes & Noble',
    'abebooks': 'AbeBooks',
    'alibris': 'Alibris',
    'thriftbooks': 'ThriftBooks',
    'bookdepository': 'Book Depository',
    'waterstones': 'Waterstones',
    'powells': "Powell's Books",
    'strand': 'Strand Books',
    'ebay': 'eBay',
    'etsy': 'Etsy',
    'mercari': 'Mercari',
    'facebook': 'Facebook Marketplace'
  };

  for (const [key, value] of Object.entries(domainMap)) {
    if (domainLower.includes(key)) {
      return value;
    }
  }

  // Clean up domain name for unknown sources
  const cleanDomain = domain.replace(/^www\./, '').split('.')[0];
  return `${cleanDomain.charAt(0).toUpperCase() + cleanDomain.slice(1)}`;
}

function extractCondition(snippet: string, item: GoogleSearchItem): string | undefined {
  const snippetLower = snippet.toLowerCase();
  
  // Check structured data first
  if (item.pagemap?.product) {
    for (const product of item.pagemap.product) {
      if (product.availability) {
        const availability = product.availability.toLowerCase();
        if (availability.includes('new')) return 'New';
        if (availability.includes('used')) return 'Used';
        if (availability.includes('refurbished')) return 'Refurbished';
      }
    }
  }

  // Extract from snippet
  const conditions = [
    { pattern: /\b(new|brand new)\b/i, value: 'New' },
    { pattern: /\b(used|pre-owned|second-hand)\b/i, value: 'Used' },
    { pattern: /\b(like new|excellent)\b/i, value: 'Like New' },
    { pattern: /\b(good condition)\b/i, value: 'Good' },
    { pattern: /\b(fair condition)\b/i, value: 'Fair' },
    { pattern: /\b(refurbished|renewed)\b/i, value: 'Refurbished' }
  ];

  for (const condition of conditions) {
    if (condition.pattern.test(snippetLower)) {
      return condition.value;
    }
  }

  return undefined;
}

function extractSeller(item: GoogleSearchItem, domain: string): string | undefined {
  // For marketplace sites, try to extract seller info
  if (domain.includes('ebay') || domain.includes('etsy') || domain.includes('amazon')) {
    const snippet = item.snippet;
    
    // eBay seller pattern
    const ebaySellerMatch = snippet.match(/seller:\s*([^,\n]+)/i);
    if (ebaySellerMatch) {
      return ebaySellerMatch[1].trim();
    }
    
    // Amazon seller pattern
    const amazonSellerMatch = snippet.match(/sold by\s+([^,\n]+)/i);
    if (amazonSellerMatch) {
      return amazonSellerMatch[1].trim();
    }
  }
  
  return undefined;
}

function cleanTitle(title: string): string {
  // Remove common suffixes and clean up title
  const cleanTitle = title
    .replace(/\s*-\s*(Amazon\.com|Barnes & Noble|eBay|Etsy).*$/i, '')
    .replace(/\s*\|\s*.*$/, '')
    .replace(/\s*:\s*Books\s*$/, '')
    .trim();
  
  return cleanTitle.length > 100 ? cleanTitle.substring(0, 100) + '...' : cleanTitle;
}

function getRelevanceScore(result: SearchResult): number {
  let score = 0;
  
  // Prioritize known book retailers
  const premiumSources = ['Amazon', 'Barnes & Noble', 'AbeBooks', 'ThriftBooks'];
  if (premiumSources.includes(result.source)) {
    score += 10;
  }
  
  // Prioritize results with prices
  if (result.price && !result.price.includes('See listing')) {
    score += 5;
  }
  
  // Prioritize results with condition info
  if (result.condition) {
    score += 3;
  }
  
  // Prioritize new books slightly
  if (result.condition === 'New') {
    score += 2;
  }
  
  return score;
}

// Export the main function and utility functions
export { 
  searchGoogleApi, 
  getCurrentQuotaUsage, 
  cleanupOldQuotaDocuments,
  MAX_DAILY_QUERIES 
};
