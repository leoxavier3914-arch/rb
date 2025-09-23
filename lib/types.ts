export type AbandonedCart = {
  id: string;
  customer_email: string;
  customer_name: string | null;
  product_name: string | null;
  product_id: string | null;
  status: string;
  paid: boolean;
  paid_at: string | null;
  discount_code: string | null;
  expires_at: string | null; // schedule_at / expires_at
  last_event: string | null;
  last_reminder_at: string | null; // sent_at
  created_at: string | null;
  updated_at: string | null;
  checkout_url?: string | null;
};

export type Sale = {
  id: string;
  customer_email: string;
  customer_name: string | null;
  product_name: string | null;
  product_id: string | null;
  status: string | null;
  paid_at: string | null;
  traffic_source: string | null;
};
