export interface ConversationContext {
  userId?: string;
  userName?: string; // For personalization
  location?: {
    city?: string;
    coordinates?: {
      lat: number;
      lng: number;
    };
    radius?: number; // in km
  };
  previousQueries: Array<{
    query: string;
    timestamp: string;
    intent?: string;
  }>;
  waitingForClarification?: {
    missingFields: string[];
    originalQuery: string;
  };
  createdAt?: string; // ISO timestamp when conversation started
}

export interface IntentResult {
  intent: string;
  missingFields: string[];
  confidence: number;
  extractedData?: {
    location?: string;
    radius?: number;
    date?: string;
    category?: string;
    [key: string]: unknown;
  };
}

export interface ValidatedQuery {
  originalQuery: string;
  intent: string;
  missingFields: string[];
  confidence: number;
  extractedData?: IntentResult["extractedData"];
  isComplete: boolean;
}

export interface PlacesEventsData {
  places?: Array<{
    name: string;
    address: string;
    rating?: number;
    types?: string[];
    location?: {
      lat: number;
      lng: number;
    };
  }>;
  events?: Array<{
    name: string;
    date: string;
    location: string;
    description?: string;
  }>;
}
