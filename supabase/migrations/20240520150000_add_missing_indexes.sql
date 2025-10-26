create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

begin;

create index if not exists app_events_status_seen_idx on app_events(status, seen_at);

create index if not exists jobs_status_idx on jobs(status);

create index if not exists kfy_sales_customer_idx on kfy_sales(customer_id);
create index if not exists kfy_sales_id_lower_idx on kfy_sales(lower(id));

create index if not exists kfy_subscriptions_customer_idx on kfy_subscriptions(customer_id);
create index if not exists kfy_subscriptions_product_idx on kfy_subscriptions(product_id);

create index if not exists kfy_enrollments_customer_idx on kfy_enrollments(customer_id);

create index if not exists kfy_refunds_sale_idx on kfy_refunds(sale_id);

create index if not exists kfy_coupons_code_lower_idx on kfy_coupons(lower(code));

create index if not exists kfy_products_title_lower_idx on kfy_products(lower(title));

create index if not exists kfy_customers_name_lower_idx on kfy_customers(lower(name));

commit;
