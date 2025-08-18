import { 
    collection, 
    doc, 
    addDoc, 
    deleteDoc, 
    getDocs, 
    query, 
    where, 
    orderBy, 
    Timestamp 
  } from 'firebase/firestore';
  import { db } from './firebase';
  import { type SearchResult } from '../types';
  
  export interface SavedSearchItem extends SearchResult {
    savedAt: Timestamp;
    userId: string;
    dbId?: string; // Firestore document ID for removal operations
  }
  
  export interface DeletedSearchItem {
    id: string;
    resultId: string;
    userId: string;
    deletedAt: Timestamp;
  }
  
  const SAVED_ITEMS_COLLECTION = 'savedSearchItems';
  const DELETED_ITEMS_COLLECTION = 'deletedSearchItems';
  
  export class FirebaseSearchService {
    // Save a search result
    static async saveSearchResult(result: SearchResult, userId: string): Promise<void> {
      try {
        // Check if already saved to prevent duplicates
        const isAlreadySaved = await this.isResultSaved(result.id, userId);
        if (isAlreadySaved) {
          throw new Error('Item is already saved');
        }
  
        const savedItem: Omit<SavedSearchItem, 'id'> = {
          ...result,
          savedAt: Timestamp.now(),
          userId
        };
        
        await addDoc(collection(db, SAVED_ITEMS_COLLECTION), savedItem);
      } catch (error) {
        console.error('Error saving search result:', error);
        throw new Error(error instanceof Error ? error.message : 'Failed to save search result');
      }
    }
  
    // Remove a saved search result
    static async removeSavedSearchResult(resultId: string, userId: string): Promise<void> {
      try {
        // First try to find by the original search result ID
        let q = query(
          collection(db, SAVED_ITEMS_COLLECTION),
          where('id', '==', resultId),
          where('userId', '==', userId)
        );
        
        let snapshot = await getDocs(q);
        
        // If not found by original ID, try by Firestore document ID
        if (snapshot.empty) {
          try {
            const docRef = doc(db, SAVED_ITEMS_COLLECTION, resultId);
            await deleteDoc(docRef);
            return;
          } catch (docError) {
            throw new Error('Saved item not found');
          }
        }
  
        const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(deletePromises);
      } catch (error) {
        console.error('Error removing saved search result:', error);
        throw new Error(error instanceof Error ? error.message : 'Failed to remove saved search result');
      }
    }
  
    // Get all saved search results for a user
    static async getSavedSearchResults(userId: string): Promise<SavedSearchItem[]> {
      try {
        const q = query(
          collection(db, SAVED_ITEMS_COLLECTION),
          where('userId', '==', userId),
          orderBy('savedAt', 'desc')
        );

        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            ...data,
            dbId: doc.id
          } as SavedSearchItem;
        });
      } catch (error) {
        console.error('Error getting saved search results:', error);
        throw new Error('Failed to get saved search results');
      }
    }
  
    // Mark a search result as deleted (hidden)
    static async deleteSearchResult(result: SearchResult, userId: string): Promise<void> {
      try {
        // Check if already deleted to prevent duplicates
        const isAlreadyDeleted = await this.isResultDeleted(result.link, userId);
        if (isAlreadyDeleted) {
          throw new Error('Item is already hidden');
        }
  
        const deletedItem: Omit<DeletedSearchItem, 'id'> = {
          resultId: result.link,
          userId,
          deletedAt: Timestamp.now()
        };
        
        await addDoc(collection(db, DELETED_ITEMS_COLLECTION), deletedItem);
      } catch (error) {
        console.error('Error deleting search result:', error);
        throw new Error(error instanceof Error ? error.message : 'Failed to delete search result');
      }
    }
  
    // Get all deleted search result IDs for a user
    static async getDeletedSearchResultIds(userId: string): Promise<string[]> {
      try {
        const q = query(
          collection(db, DELETED_ITEMS_COLLECTION),
          where('userId', '==', userId)
        );
        
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => doc.data().resultId as string);
      } catch (error) {
        console.error('Error getting deleted search results:', error);
        throw new Error('Failed to get deleted search results');
      }
    }
  
    // Get both saved and deleted items in one call for efficiency
    static async getUserSearchData(userId: string): Promise<{
      savedItems: SavedSearchItem[];
      savedItemIds: string[];
      deletedItemIds: string[];
    }> {
      try {
        // Fetch saved items and deleted items in parallel
        const [savedItems, deletedItemIds] = await Promise.all([
          this.getSavedSearchResults(userId),
          this.getDeletedSearchResultIds(userId)
        ]);
  
        const savedItemIds = savedItems.map(item => item.id);
  
        return {
          savedItems,
          savedItemIds,
          deletedItemIds
        };
      } catch (error) {
        console.error('Error getting user search data:', error);
        throw new Error('Failed to get user search data');
      }
    }
  
    // Check if a result is saved
    static async isResultSaved(resultId: string, userId: string): Promise<boolean> {
      try {
        const q = query(
          collection(db, SAVED_ITEMS_COLLECTION),
          where('id', '==', resultId),
          where('userId', '==', userId)
        );
        
        const snapshot = await getDocs(q);
        return !snapshot.empty;
      } catch (error) {
        console.error('Error checking if result is saved:', error);
        return false;
      }
    }
  
    // Check if a result is deleted
    static async isResultDeleted(resultId: string, userId: string): Promise<boolean> {
      try {
        const q = query(
          collection(db, DELETED_ITEMS_COLLECTION),
          where('resultId', '==', resultId),
          where('userId', '==', userId)
        );
        
        const snapshot = await getDocs(q);
        return !snapshot.empty;
      } catch (error) {
        console.error('Error checking if result is deleted:', error);
        return false;
      }
    }
  
    // Utility method to refresh user data (can be called after operations)
    static async refreshUserData(userId: string): Promise<{
      savedItems: SavedSearchItem[];
      savedItemIds: string[];
      deletedItemIds: string[];
    }> {
      return this.getUserSearchData(userId);
    }
  }
