alter table public.approved_sales
  add column gross_amount numeric(12,2),
  add column net_amount numeric(12,2),
  add column kiwify_commission_amount numeric(12,2),
  add column affiliate_commission_amount numeric(12,2);

alter table public.pending_payments
  add column gross_amount numeric(12,2),
  add column net_amount numeric(12,2),
  add column kiwify_commission_amount numeric(12,2),
  add column affiliate_commission_amount numeric(12,2);

alter table public.rejected_payments
  add column gross_amount numeric(12,2),
  add column net_amount numeric(12,2),
  add column kiwify_commission_amount numeric(12,2),
  add column affiliate_commission_amount numeric(12,2);

alter table public.refunded_sales
  add column gross_amount numeric(12,2),
  add column net_amount numeric(12,2),
  add column kiwify_commission_amount numeric(12,2),
  add column affiliate_commission_amount numeric(12,2);

alter table public.abandoned_carts
  add column gross_amount numeric(12,2),
  add column net_amount numeric(12,2),
  add column kiwify_commission_amount numeric(12,2),
  add column affiliate_commission_amount numeric(12,2);

alter table public.subscription_events
  add column gross_amount numeric(12,2),
  add column net_amount numeric(12,2),
  add column kiwify_commission_amount numeric(12,2),
  add column affiliate_commission_amount numeric(12,2);
