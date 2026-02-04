// types/Bundle.ts
export interface BundleRule {
  id?: string;
  tier: string;
  totalProducts: number;
  discountPercentage: number;
  discountCode?: string | null;
  shopifyPriceRuleId?: string | null;
  shopifyDiscountCodeId?: string | null;
  isActive?: boolean;
}

export interface Bundle {
  id: string;
  name: string;
  collectionId: string;
  collectionTitle: string;
  createdAt: string;
  updatedAt: string;
  rules: BundleRule[];
  discountCodes: Array<{
    code: string;
    used: boolean;
    ruleIndex?: number;
    createdAt?: string;
    discountNodeId?: string;
  }>;
}

export interface Collection {
  id: string;
  title: string;
  handle: string;
}