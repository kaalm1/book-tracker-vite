import React, { useState } from 'react';
import { Search, BookOpen } from 'lucide-react';
import { SearchResults } from '../components/search/SearchResults';
import { SavedSearchItems } from '../components/search/SavedSearchItems';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { useSearch } from '../hooks/useSearch';
import { useSavedSearch } from '../hooks/useSavedSearch';
import { useNotifications } from '../hooks/useNotifications';
import { useAuth } from '../hooks/useAuth'; // Add this import
import { type SearchResult } from '../types';

export const SearchPage: React.FC = () => {
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'search' | 'saved'>('search');
  
  // Get the current user from auth hook
  const { user } = useAuth();
  
  const {
    searchResults: results,
    loading: searchLoading,
    error: searchError,
    searchBook: searchBooks,
  } = useSearch();

  const {
    savedItems,
    savedItemIds,
    deletedItemIds,
    loading: savedLoading,
    error: savedError,
    saveSearchResult,
    removeSavedSearchResult,
    deleteSearchResult
  } = useSavedSearch();

  // Pass userId to useNotifications hook
  const { addNotification } = useNotifications(user?.uid || null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      await searchBooks(query.trim());
      setActiveTab('search');
    }
  };

  const handleNotifyMe = (result: SearchResult) => {
    // Create notification object that matches your Notification type structure
    addNotification({
      bookTitle: result.title,
      price: result.price,
      source: result.source,
      link: result.link,
      date: new Date().toISOString().split('T')[0],
      read: false
    });
  };

  const handleSave = async (result: SearchResult) => {
    try {
      await saveSearchResult(result);
      addNotification({
        bookTitle: `${result.title} - Saved`,
        price: result.price,
        source: 'System',
        link: result.link,
        date: new Date().toISOString().split('T')[0],
        read: false
      });
    } catch (error) {
      addNotification({
        bookTitle: `Failed to save: ${result.title}`,
        price: '',
        source: 'System',
        link: '',
        date: new Date().toISOString().split('T')[0],
        read: false
      });
    }
  };

  const handleDelete = async (result: SearchResult) => {
    try {
      await deleteSearchResult(result);
      addNotification({
        bookTitle: `${result.title} - Hidden`,
        price: result.price,
        source: 'System',
        link: result.link,
        date: new Date().toISOString().split('T')[0],
        read: false
      });
    } catch (error) {
      addNotification({
        bookTitle: `Failed to hide: ${result.title}`,
        price: '',
        source: 'System',
        link: '',
        date: new Date().toISOString().split('T')[0],
        read: false
      });
    }
  };

  const handleRemoveSaved = async (result: SearchResult) => {
    try {
      await removeSavedSearchResult(result.id);
      addNotification({
        bookTitle: `${result.title} - Removed from saved`,
        price: result.price,
        source: 'System',
        link: result.link,
        date: new Date().toISOString().split('T')[0],
        read: false
      });
    } catch (error) {
      addNotification({
        bookTitle: `Failed to remove: ${result.title}`,
        price: '',
        source: 'System',
        link: '',
        date: new Date().toISOString().split('T')[0],
        read: false
      });
    }
  };

  // Don't render if user is not authenticated
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Please log in</h2>
          <p className="text-gray-600">You need to be logged in to use the search feature.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Book Search & Save
          </h1>
          <p className="text-gray-600">
            Search for books across multiple platforms and save your favorites
          </p>
        </div>

        {/* Search Form */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
          <form onSubmit={handleSearch} className="flex space-x-4">
            <div className="flex-1">
              <Input
                type="text"
                placeholder="Search for books (title, author, ISBN)..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full"
              />
            </div>
            <Button
              type="submit"
              disabled={searchLoading || !query.trim()}
              className="px-6"
            >
              <Search className="h-4 w-4 mr-2" />
              Search
            </Button>
          </form>

          {searchError && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-red-600 text-sm">{searchError}</p>
            </div>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-1 mb-6">
          <button
            onClick={() => setActiveTab('search')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'search'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            <Search className="h-4 w-4 inline mr-2" />
            Search Results
            {results.length > 0 && (
              <span className="ml-1 bg-white bg-opacity-20 px-2 py-0.5 rounded-full text-xs">
                {results.filter(r => !deletedItemIds.includes(r.id)).length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('saved')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'saved'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            <BookOpen className="h-4 w-4 inline mr-2" />
            Saved Items
            {savedItems.length > 0 && (
              <span className="ml-1 bg-white bg-opacity-20 px-2 py-0.5 rounded-full text-xs">
                {savedItems.length}
              </span>
            )}
          </button>
        </div>

        {/* Error Messages */}
        {savedError && (
          <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-600 text-sm">{savedError}</p>
          </div>
        )}

        {/* Content */}
        {activeTab === 'search' && (
          <SearchResults
            results={results}
            loading={searchLoading}
            savedItemIds={savedItemIds}
            deletedItemIds={deletedItemIds}
            onNotifyMe={handleNotifyMe}
            onSave={handleSave}
            onDelete={handleDelete}
          />
        )}

        {activeTab === 'saved' && (
          <SavedSearchItems
            savedItems={savedItems}
            loading={savedLoading}
            onNotifyMe={handleNotifyMe}
            onRemove={handleRemoveSaved}
          />
        )}

        {/* Empty State */}
        {activeTab === 'search' && !searchLoading && results.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <Search className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-medium text-gray-900 mb-2">
              Ready to Search
            </h3>
            <p className="text-gray-600 mb-6">
              Enter a book title, author, or ISBN above to get started
            </p>
            <div className="text-sm text-gray-500">
              <p className="mb-2">Search tips:</p>
              <ul className="space-y-1">
                <li>• Use specific titles for better results</li>
                <li>• Try author names or ISBN numbers</li>
                <li>• Save interesting finds for later</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
