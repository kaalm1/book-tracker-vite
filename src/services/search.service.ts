import { type SearchResult } from '../types';
import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase'; // Assuming you export functions from your firebase config


export class SearchServiceClass {
    async searchAllSources(bookTitle: string, author?: string, topic?: string): Promise<SearchResult[]> {
        try {
          const searchBookFunction = httpsCallable<
            { bookTitle: string; author?: string, topic?: string },
            { results: SearchResult[] }
          >(functions, 'searchBook');
      
          const result = await searchBookFunction({ bookTitle, author, topic });
          return result.data.results || [];
        } catch (error) {
          console.error('Error searching all sources:', error);
          return [];
        }
      }

}