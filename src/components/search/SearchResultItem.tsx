import React from 'react';
import { ExternalLink, Mail, BookmarkPlus, Trash2, Bookmark } from 'lucide-react';
import { type SearchResult } from '../../types';

interface SearchResultItemProps {
  result: SearchResult;
  onNotifyMe: (result: SearchResult) => void;
  onSave: (result: SearchResult) => void;
  onDelete: (result: SearchResult) => void;
  isSaved?: boolean;
  isDeleted?: boolean;
}

export const SearchResultItem: React.FC<SearchResultItemProps> = ({
  result,
  onNotifyMe,
  onSave,
  onDelete,
  isSaved = false,
  isDeleted = false
}) => {
  // Don't render if item is deleted
  if (isDeleted) {
    return null;
  }

  return (
    <div className={`border rounded-lg p-4 hover:shadow-sm transition-shadow ${
      isSaved ? 'border-green-200 bg-green-50' : 'border-gray-200'
    }`}>
      <div className="flex justify-between items-start mb-2">
        <h4 className="font-medium text-gray-900 flex-1 pr-2">{result.title}</h4>
        <span className="text-lg font-bold text-green-600 whitespace-nowrap">
          {result.price}
        </span>
      </div>
      
      {result.condition && (
        <p className="text-sm text-gray-600 mb-1">{result.condition}</p>
      )}
      
      <p className="text-xs text-gray-500 mb-3">
        {result.source} {result.seller && `• ${result.seller}`}
      </p>
      
      <div className="flex space-x-3">
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
        
        {!isSaved ? (
          <button
            onClick={() => onSave(result)}
            className="inline-flex items-center text-blue-600 hover:text-blue-800 text-sm transition-colors"
          >
            <BookmarkPlus className="h-4 w-4 mr-1" />
            Save
          </button>
        ) : (
          <span className="inline-flex items-center text-green-700 text-sm">
            <Bookmark className="h-4 w-4 mr-1" />
            Saved
          </span>
        )}
        
        <button
          onClick={() => onDelete(result)}
          className="inline-flex items-center text-red-600 hover:text-red-800 text-sm transition-colors"
        >
          <Trash2 className="h-4 w-4 mr-1" />
          Hide
        </button>
      </div>
    </div>
  );
};
