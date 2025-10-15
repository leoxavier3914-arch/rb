export type AbandonedCartSnapshot = {
  id: string;
  checkout_id: string | null;
  customer_email: string;
  customer_name: string | null;
  customer_phone: string | null;
  product_name: string | null;
  product_id: string | null;
  status: string;
  paid: boolean;
  paid_at: string | null;
  discount_code: string | null;
  expires_at: string | null; // schedule_at / expires_at
  last_event: string | null;
  created_at: string | null;
  updated_at: string | null;
  checkout_url?: string | null;
  traffic_source?: string | null;
};

export type AbandonedCartUpdate = {
  id: string;
  timestamp: string | null;
  status: string | null;
  event: string | null;
  source: string | null;
  snapshot: AbandonedCartSnapshot;
};

export type AbandonedCartHistoryEntry = {
  cartKey: string;
  snapshot: AbandonedCartSnapshot;
  updates: AbandonedCartUpdate[];
};

export type AbandonedCart = AbandonedCartSnapshot & {
  cart_key: string;
  updates: AbandonedCartUpdate[];
  history: AbandonedCartHistoryEntry[];
};

export type Sale = {
  id: string;
  customer_email: string;
  customer_name: string | null;
  customer_phone: string | null;
  product_name: string | null;
  product_id: string | null;
  status: 'approved' | 'refunded';
  created_at: string | null;
  updated_at: string | null;
  paid_at: string | null;
  traffic_source: string | null;
  source: string | null;
  abandoned_before_payment: boolean;
  checkout_url: string | null;
};

export type DashboardSaleStatus =
  | 'new'
  | 'approved'
  | 'abandoned'
  | 'refunded'
  | 'refused';

export type DashboardSale = {
  id: string;
  customer_email: string;
  customer_name: string | null;
  customer_phone: string | null;
  product_name: string | null;
  product_id: string | null;
  status: DashboardSaleStatus;
  created_at: string | null;
  updated_at: string | null;
  paid_at: string | null;
  last_event: string | null;
  traffic_source: string | null;
  source: string | null;
  checkout_url: string | null;
};

export type GroupedDashboardEventSource = 'created_at' | 'updated_at' | 'paid_at' | null;

export type GroupedDashboardEvent = DashboardSale & {
  latest_timestamp: string | null;
  latest_timestamp_source: GroupedDashboardEventSource;
};

export type FeedbackEntry = {
  id: string;
  customer_email: string;
  customer_name: string | null;
  customer_phone: string | null;
  product_name: string | null;
  status: 'pending' | 'abandoned' | 'approved' | 'refunded' | 'refused';
  paid_at: string | null;
  last_cart_activity: string | null;
  checkout_url: string | null;
  origin: 'sale' | 'cart' | 'mixed';
};
