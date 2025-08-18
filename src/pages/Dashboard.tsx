import React, { useState } from 'react';
import { type User } from '../types';
import { Layout } from '../components/layout/Layout';
import { BookList } from '../components/books/BookList';
import { SearchResults } from '../components/search/SearchResults';
import { SavedSearchItems } from '../components/search/SavedSearchItems';
import { useAuth } from '../hooks/useAuth';
import { useBooks } from '../hooks/useBooks';
import { useSearch } from '../hooks/useSearch';
import { useNotifications } from '../hooks/useNotifications';
import { useSavedSearch } from '../hooks/useSavedSearch';

interface DashboardProps {
  user: User;
}

export const Dashboard: React.FC<DashboardProps> = ({ user }) => {
  const { signOut } = useAuth();
  const { books, addBook, removeBook, loading: booksLoading } = useBooks(user.uid);
  const { searchResults, searchBook, loading: searchLoading } = useSearch();
  const { notifications, addNotification } = useNotifications(user.uid);
  
  // Add the saved search hook
  const {
    savedItems,
    savedItemIds,
    deletedItemIds,
    loading: savedLoading,
    saveSearchResult,
    removeSavedSearchResult,
    deleteSearchResult,
    error: savedSearchError
  } = useSavedSearch();
  
  const [showSettings, setShowSettings] = useState(false);

  const handleAddBook = async (title: string, author?: string, topic?: string) => {
    await addBook(title, author, topic);
  };

  const handleRemoveBook = async (bookId: string) => {
    await removeBook(bookId);
  };

  const handleSearchBook = async (bookTitle: string, author?: string, topic?: string) => {
    await searchBook(bookTitle, author, topic);
  };

  const handleNotifyMe = async (searchResult: any) => {
    const notification = {
      bookTitle: searchResult.title,
      price: searchResult.price,
      source: searchResult.source,
      link: searchResult.link,
      date: new Date().toISOString().split('T')[0],
      read: false
    };
    
    await addNotification(notification);
    
    // Show success message
    alert(`Email notification sent! Found "${searchResult.title}" for ${searchResult.price} on ${searchResult.source}`);
  };

  // Handle saving search results
  const handleSave = async (searchResult: any) => {
    try {
      await saveSearchResult(searchResult);
      alert(`"${searchResult.title}" has been saved to your collection!`);
    } catch (error) {
      console.error('Error saving search result:', error);
      alert('Failed to save item. Please try again.');
    }
  };

  // Handle deleting/hiding search results
  const handleDelete = async (searchResult: any) => {
    try {
      await deleteSearchResult(searchResult);
      alert(`"${searchResult.title}" has been hidden from search results.`);
    } catch (error) {
      console.error('Error hiding search result:', error);
      alert('Failed to hide item. Please try again.');
    }
  };

  // Handle removing saved search results
  const handleRemoveSaved = async (searchResult: any) => {
    try {
      // Use dbId (Firestore document ID) if available, otherwise use the original ID
      const idToRemove = searchResult.dbId || searchResult.id;
      await removeSavedSearchResult(idToRemove);
      alert(`"${searchResult.title}" has been removed from your saved items.`);
    } catch (error) {
      console.error('Error removing saved search result:', error);
      alert('Failed to remove item. Please try again.');
    }
  };

  const handleToggleSettings = () => {
    setShowSettings(!showSettings);
  };

  return (
    <Layout
      user={user}
      notificationCount={notifications.filter(n => !n.read).length}
      onSignOut={signOut}
      onToggleSettings={handleToggleSettings}
    >
      {/* Show saved search error if any */}
      {savedSearchError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-600 text-sm">{savedSearchError}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Book Management */}
        <div className="lg:col-span-2">
          <BookList
            books={books}
            onAddBook={handleAddBook}
            onRemoveBook={handleRemoveBook}
            onSearchBook={handleSearchBook}
            loading={booksLoading}
            searchLoading={searchLoading}
          />
        </div>

        {/* Saved Items, Search Results & Notifications */}
        <div className="space-y-6">
          {/* Saved Search Items */}
          <SavedSearchItems
            savedItems={savedItems}
            loading={savedLoading}
            onNotifyMe={handleNotifyMe}
            onRemove={handleRemoveSaved}
          />
          
          {/* Current Search Results */}
          <SearchResults
            results={searchResults}
            loading={searchLoading}
            savedItemIds={savedItemIds}
            deletedItemIds={deletedItemIds}
            onNotifyMe={handleNotifyMe}
            onSave={handleSave}
            onDelete={handleDelete}
          />
        </div>
      </div>
    </Layout>
  );
};