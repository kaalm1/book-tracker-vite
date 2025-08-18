import { useState, useEffect, useCallback } from 'react';
import { FirebaseSearchService, type SavedSearchItem } from '../services/firebase-search.service';
import { type SearchResult } from '../types';
import { useAuth } from './useAuth';

interface UseSavedSearchReturn {
  savedItems: SavedSearchItem[];
  savedItemIds: string[];
  deletedItemIds: string[];
  loading: boolean;
  error: string | null;
  saveSearchResult: (result: SearchResult) => Promise<void>;
  removeSavedSearchResult: (resultId: string) => Promise<void>;
  deleteSearchResult: (result: SearchResult) => Promise<void>;
  refreshData: () => Promise<void>;
  isResultSaved: (resultId: string) => boolean;
  isResultDeleted: (resultId: string) => boolean;
}

export const useSavedSearch = (): UseSavedSearchReturn => {
  const { user } = useAuth();
  const [savedItems, setSavedItems] = useState<SavedSearchItem[]>([]);
  const [savedItemIds, setSavedItemIds] = useState<string[]>([]);
  const [deletedItemIds, setDeletedItemIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch data from Firebase
  const fetchData = useCallback(async () => {
    if (!user?.uid) return;

    setLoading(true);
    setError(null);

    try {
      const userData = await FirebaseSearchService.getUserSearchData(user.uid);
      setSavedItems(userData.savedItems);
      setSavedItemIds(userData.savedItemIds);
      setDeletedItemIds(userData.deletedItemIds);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch data';
      setError(errorMessage);
      console.error('Error fetching saved search data:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  // Load data on mount and when user changes
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Refresh data manually
  const refreshData = useCallback(async (): Promise<void> => {
    await fetchData();
  }, [fetchData]);

  // Save a search result
  const saveSearchResult = useCallback(async (result: SearchResult): Promise<void> => {
    if (!user?.uid) {
      throw new Error('User not authenticated');
    }

    try {
      setError(null);
      await FirebaseSearchService.saveSearchResult(result, user.uid);
      
      // Refresh data after successful save
      await fetchData();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save search result';
      setError(errorMessage);
      throw err;
    }
  }, [user?.uid, fetchData]);

  // Remove a saved search result
  const removeSavedSearchResult = useCallback(async (resultId: string): Promise<void> => {
    if (!user?.uid) {
      throw new Error('User not authenticated');
    }

    try {
      setError(null);
      await FirebaseSearchService.removeSavedSearchResult(resultId, user.uid);
      
      // Refresh data after successful removal
      await fetchData();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to remove saved search result';
      setError(errorMessage);
      throw err;
    }
  }, [user?.uid, fetchData]);

  // Delete (hide) a search result
  const deleteSearchResult = useCallback(async (result: SearchResult): Promise<void> => {
    if (!user?.uid) {
      throw new Error('User not authenticated');
    }

    try {
      setError(null);
      await FirebaseSearchService.deleteSearchResult(result, user.uid);
      
      // Refresh data after successful deletion
      await fetchData();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete search result';
      setError(errorMessage);
      throw err;
    }
  }, [user?.uid, fetchData]);

  // Check if a result is saved (using local state for performance)
  const isResultSaved = useCallback((resultId: string): boolean => {
    return savedItemIds.includes(resultId);
  }, [savedItemIds]);

  // Check if a result is deleted (using local state for performance)
  const isResultDeleted = useCallback((resultId: string): boolean => {
    return deletedItemIds.includes(resultId);
  }, [deletedItemIds]);

  return {
    savedItems,
    savedItemIds,
    deletedItemIds,
    loading,
    error,
    saveSearchResult,
    removeSavedSearchResult,
    deleteSearchResult,
    refreshData,
    isResultSaved,
    isResultDeleted
  };
};
