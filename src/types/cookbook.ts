export type CookbookSortKey = 'recent' | 'title_asc' | 'time_asc' | 'time_desc';

export type CookbookFilter = 'all' | 'favorites' | string; // string = a cuisine name

export interface CookbookViewState {
  searchQuery: string;
  activeFilter: CookbookFilter;
  sortBy: CookbookSortKey;
}

export const defaultCookbookViewState: CookbookViewState = {
  searchQuery: '',
  activeFilter: 'all',
  sortBy: 'recent',
};

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  ts: number;
}
