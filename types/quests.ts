export interface Quest {
  id: string;
  name: string;
  description: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  points: number;
  progress: number;
  isCompleted: boolean;
  category: string;
}

export interface QuestCategory {
  id: string;
  name: string;
}

export interface Notification {
  id: string;
  message: string;
  timestamp: string;
  read: boolean;
}

export interface SearchHistory {
  id: string;
  term: string;
}

export interface SearchSuggestion {
  id: string;
  term: string;
}

export interface Competition {
  id: string;
  name: string;
  description: string;
  pot: number;
}

export interface Contribution {
  id: string;
  competitionId: string;
  userId: string;
  amount: number;
}
