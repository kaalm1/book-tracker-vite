import { SearchResult } from '../types/search';
import { searchCraigslist } from './sources/craigslistService';
import { searchReddit } from './sources/redditService';
import { searcheBay } from './sources/ebayService';
import { searchGoogleApi } from './sources/googleApiService';

export async function searchAllPlatforms(bookTitle: string, author?: string): Promise<SearchResult[]> {
  const searchQuery = author ? `${bookTitle} ${author}` : bookTitle;
  const results = await Promise.all([
    searchCraigslist(searchQuery).catch(() => []),
    searchReddit(searchQuery).catch(() => []),
    searcheBay(searchQuery).catch(() => []),
    searchGoogleApi(searchQuery).catch(() => []),
  ]);
  return results.flat().filter((r, i, self) => i === self.findIndex(x => x.link === r.link));
}
