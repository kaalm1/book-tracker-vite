import React from 'react';
import { type SearchResult } from '../../types';
import { SearchResultItem } from './SearchResultItem';
import { LoadingSpinner } from '../ui/LoadingSpinner';

interface SearchResultsProps {
  results: SearchResult[];
  loading: boolean;
  savedItemIds: string[];
  deletedItemIds: string[];
  onNotifyMe: (result: SearchResult) => void;
  onSave: (result: SearchResult) => void;
  onDelete: (result: SearchResult) => void;
}

export const SearchResults: React.FC<SearchResultsProps> = ({
  results,
  loading,
  savedItemIds,
  deletedItemIds,
  onNotifyMe,
  onSave,
  onDelete
}) => {
  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6 text-center">
        <LoadingSpinner size="lg" className="text-indigo-600 mx-auto mb-2" />
        <p className="text-gray-600">Searching across all platforms...</p>
      </div>
    );
  }
  console.log(deletedItemIds)
  // Filter out deleted items from results
  const filteredResults = results.filter(result => {
    const truncatedLink = result.link.slice(0, 40);
    return !deletedItemIds.some(id => id.slice(0, 40) === truncatedLink);
  });

  if (filteredResults.length === 0 && results.length === 0) {
    return null;
  }

  if (filteredResults.length === 0 && results.length > 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6 text-center">
        <p className="text-gray-600">All search results have been hidden.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Search Results ({filteredResults.length} found)
      </h3>
      
      <div className="space-y-4">
        {filteredResults.map((result) => (
          <SearchResultItem
            key={result.id}
            result={result}
            onNotifyMe={onNotifyMe}
            onSave={onSave}
            onDelete={onDelete}
            isSaved={savedItemIds.includes(result.id)}
            isDeleted={deletedItemIds.includes(result.id)}
          />
        ))}
      </div>
    </div>
  );
};