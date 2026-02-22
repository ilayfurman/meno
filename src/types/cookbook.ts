export type CookbookMode = 'browse' | 'select' | 'reorder';

export type CookbookSortKey = 'recent' | 'title_asc' | 'time_asc' | 'time_desc';

export type CookbookQuickFilter = 'quick' | 'comfort' | 'gf' | 'veg' | 'favorites';

export interface CookbookFilterState {
  quick: CookbookQuickFilter[];
  difficulty: Array<'easy' | 'medium'>;
  cuisines: string[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  ts: number;
}

export const defaultCookbookFilters: CookbookFilterState = {
  quick: [],
  difficulty: [],
  cuisines: [],
};
