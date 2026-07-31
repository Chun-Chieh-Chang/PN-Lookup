export type ItemType = 'part' | 'assembly';

export interface PartItem {
  id: string;
  customer: string;
  partNo: string;
  name: string;
  notes?: string;
  alternates?: string[];
  itemType?: ItemType;
  components?: string[];
  usedInAssemblies?: string[];
  createdAt?: string;
}

export type SearchField = 'all' | 'partNo' | 'customer' | 'name';

export interface FilterState {
  keyword: string;
  searchField: SearchField;
  selectedCustomers: string[];
  prefixFilter: string;
  itemTypeFilter: 'all' | 'part' | 'assembly';
  matchMode: 'fuzzy' | 'exact';
  sortField?: string;
  sortOrder?: 'asc' | 'desc';
}


