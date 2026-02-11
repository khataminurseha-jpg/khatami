
export interface DrillItem {
  id: string;
  category: string;
  name: string;
  base: number;
  fact: number;
  total: number;
  dailyValues: number[]; // 6 days (Mon-Sat)
}

export interface Variation {
  id: string;
  drillId: number;
  name: string;
  sets: number;
  reps: string;
}

export interface SessionData {
  id: number;
  day: string;
  category: string;
  drill: string;
  targetSets: string;
  repsPerSet: number;
  rest: string;
}

export interface AppData {
  teamName: string;
  drills: DrillItem[];
  variations: Record<string, Variation[]>; // key is drillId from SessionData
}

export interface User {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}
