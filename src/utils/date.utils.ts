export const dateUtils = {
    formatRelative: (dateString: string): string => {
      const date = new Date(dateString);
      const now = new Date();
      const diffInMs = now.getTime() - date.getTime();
      const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
      
      if (diffInDays === 0) return 'Today';
      if (diffInDays === 1) return 'Yesterday';
      if (diffInDays < 7) return `${diffInDays} days ago`;
      if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} weeks ago`;
      if (diffInDays < 365) return `${Math.floor(diffInDays / 30)} months ago`;
      
      return `${Math.floor(diffInDays / 365)} years ago`;
    },
  
    isToday: (dateString: string): boolean => {
      const date = new Date(dateString);
      const today = new Date();
      return date.toDateString() === today.toDateString();
    },
  
    formatForInput: (date: Date = new Date()): string => {
      return date.toISOString().split('T')[0];
    },
  
    addDays: (date: Date, days: number): Date => {
      const result = new Date(date);
      result.setDate(result.getDate() + days);
      return result;
    }
  };
  