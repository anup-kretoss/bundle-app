export interface Bundle {
  id: string;
  name: string;
  collectionId: string;
  collectionTitle: string;
  createdAt: string;
  updatedAt: string;
  rules?: string; // Store rules as a JSON string in the database
}

export interface BundleRule {
  id?: string;
  type: string; // "quantity", "price", etc.
  operator?: string; // "is greater than or equal to", "equals", etc.
  value: string | number;
  discount?: number;
  discountCode?: string; // Generated code like "SILVER-12345"
  tier?: string; // "SILVER", "GOLD", "PLATINUM"
}

export interface Collection {
  id: string;
  title: string;
  handle: string;
}
