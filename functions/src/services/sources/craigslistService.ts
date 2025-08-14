import axios from 'axios';
import * as cheerio from 'cheerio';
import { v4 as uuidv4 } from 'uuid';
import { SearchResult } from '../../types/search';


export async function searchCraigslist(searchQuery: string): Promise<SearchResult[]> {
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