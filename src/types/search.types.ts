export interface SearchResult {
    id: string;
    title: string;
    price: string;
    source: SearchSource;
    condition?: string;
    link: string;
    seller?: string;
    imageUrl?: string;
  }
  
export type SearchSource = 'facebook' | 'craigslist' | 'reddit' | 'ebay' | 'amazon';
  
export interface SearchState {
    results: SearchResult[];
    loading: boolean;
    error: string | null;
  }


export interface SavedSearchResult extends SearchResult {
    savedAt: Date;
    userId: string;
  }
  
export interface DeletedSearchItem {
    id: string;
    resultId: string;
    userId: string;
    deletedAt: Date;
  }
  
export interface SearchItemActions {
    onSave: (result: SearchResult) => void;
    onDelete: (result: SearchResult) => void;
    onNotifyMe: (result: SearchResult) => void;
  }
  
export interface SearchFilters {
    showSavedOnly?: boolean;
    hideDeleted?: boolean;
    sources?: string[];
    priceRange?: {
      min?: number;
      max?: number;
    };
    conditions?: string[];
  }
