import axios from 'axios';
import * as cheerio from 'cheerio';
import { v4 as uuidv4 } from 'uuid';
import { SearchResult } from '../../types/search';


export async function searcheBay(searchQuery: string): Promise<SearchResult[]> {
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