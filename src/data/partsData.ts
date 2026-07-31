import { PartItem } from '../types';

// Empty initial dataset — real data is loaded from server API or localStorage at runtime.
// See App.tsx: loadParts() → server API → localStorage fallback.
export const INITIAL_PARTS_DATA: PartItem[] = [];
