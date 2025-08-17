export interface Book {
    id: string;
    title: string;
    author?: string;
    topic?: string;
    addedDate: string;
    userId: string;
  }
  
export interface BookState {
    books: Book[];
    loading: boolean;
    error: string | null;
  }
