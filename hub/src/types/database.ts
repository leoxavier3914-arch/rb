export interface SalesRow {
  id: string;
  status: string | null;
  product_name: string | null;
  customer_name: string | null;
  customer_email: string | null;
  total_amount_cents: number;
  net_amount_cents: number;
  fee_amount_cents: number;
  currency: string | null;
  created_at: string | null;
  paid_at: string | null;
  updated_at: string | null;
  raw: unknown;
}

export interface SalesInsert {
  id: string;
  status?: string | null;
  product_name?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  total_amount_cents?: number;
  net_amount_cents?: number;
  fee_amount_cents?: number;
  currency?: string | null;
  created_at?: string | null;
  paid_at?: string | null;
  updated_at?: string | null;
  raw?: unknown;
}

export interface Database {
  public: {
    Tables: {
      sales: {
        Row: SalesRow;
        Insert: SalesInsert;
        Update: Partial<SalesInsert>;
      };
    };
    Functions: {
      sales_stats: {
        Args: Record<string, never>;
        Returns: Array<{
          total_sales: number;
          gross_amount_cents: number;
          net_amount_cents: number;
          fee_amount_cents: number;
          last_sale_at: string | null;
        }>;
      };
    };
  };
}
