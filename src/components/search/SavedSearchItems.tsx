import React from 'react';
import { ExternalLink, Mail, Bookmark, Trash2 } from 'lucide-react';
import { type SearchResult } from '../../types';
import { LoadingSpinner } from '../ui/LoadingSpinner';

interface SavedSearchItemProps {
  result: SearchResult;
  onNotifyMe: (result: SearchResult) => void;
  onRemove: (result: SearchResult) => void;
}

const SavedSearchItem: React.FC<SavedSearchItemProps> = ({
  result,
  onNotifyMe,
  onRemove
}) => {
  return (
    <div className="border border-green-200 bg-green-50 rounded-lg p-4 hover:shadow-sm transition-shadow">
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-start space-x-2">
          <Bookmark className="h-4 w-4 text-green-600 mt-1 flex-shrink-0" />
          <h4 className="font-medium text-gray-900 flex-1">{result.title}</h4>
        </div>
        <span className="text-lg font-bold text-green-600 whitespace-nowrap ml-2">
          {result.price}
        </span>
      </div>
      
      {result.condition && (
        <p className="text-sm text-gray-600 mb-1 ml-6">{result.condition}</p>
      )}
      
      <p className="text-xs text-gray-500 mb-3 ml-6">
        {result.source} {result.seller && `• ${result.seller}`}
      </p>
      
      <div className="flex space-x-3 ml-6">
        <a
          href={result.link}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center text-indigo-600 hover:text-indigo-800 text-sm transition-colors"
        >
          <ExternalLink className="h-4 w-4 mr-1" />
          View Listing
        </a>
        
        <button
          onClick={() => onNotifyMe(result)}
          className="inline-flex items-center text-green-600 hover:text-green-800 text-sm transition-colors"
        >
          <Mail className="h-4 w-4 mr-1" />
          Notify Me
        </button>
        
        <button
          onClick={() => onRemove(result)}
          className="inline-flex items-center text-red-600 hover:text-red-800 text-sm transition-colors"
        >
          <Trash2 className="h-4 w-4 mr-1" />
          Remove
        </button>
      </div>
    </div>
  );
};

interface SavedSearchItemsProps {
  savedItems: SearchResult[];
  loading: boolean;
  onNotifyMe: (result: SearchResult) => void;
  onRemove: (result: SearchResult) => void;
}

export const SavedSearchItems: React.FC<SavedSearchItemsProps> = ({
  savedItems,
  loading,
  onNotifyMe,
  onRemove
}) => {
  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6 text-center">
        <LoadingSpinner size="lg" className="text-indigo-600 mx-auto mb-2" />
        <p className="text-gray-600">Loading saved items...</p>
      </div>
    );
  }

  if (savedItems.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6 text-center">
        <Bookmark className="h-12 w-12 text-gray-400 mx-auto mb-3" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Saved Items</h3>
        <p className="text-gray-600">Save interesting search results to keep track of them.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
        <Bookmark className="h-5 w-5 text-green-600 mr-2" />
        Saved Items ({savedItems.length})
      </h3>
      
      <div className="space-y-4">
        {savedItems.map((item) => (
          <SavedSearchItem
            key={item.id}
            result={item}
            onNotifyMe={onNotifyMe}
            onRemove={onRemove}
          />
        ))}
      </div>
    </div>
  );
};