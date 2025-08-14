import axios from 'axios';
import * as cheerio from 'cheerio';
import { v4 as uuidv4 } from 'uuid';
import { SearchResult } from '../../types/search';


export async function searchGoogle(searchQuery: string): Promise<SearchResult[]> {
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
  