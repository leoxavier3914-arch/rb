begin;

alter table if exists kfy_orders drop constraint if exists kfy_orders_customer_id_fkey;
alter table if exists kfy_sales drop constraint if exists kfy_sales_customer_id_fkey;
alter table if exists kfy_subscriptions drop constraint if exists kfy_subscriptions_customer_id_fkey;
alter table if exists kfy_enrollments drop constraint if exists kfy_enrollments_customer_id_fkey;

alter table if exists kfy_customers alter column id drop identity if exists;
alter table if exists kfy_customers alter column id drop default;
alter table if exists kfy_customers alter column id type text using id::text;
alter table if exists kfy_customers drop constraint if exists kfy_customers_pkey;
alter table if exists kfy_customers add constraint kfy_customers_pkey primary key (id);

alter table if exists kfy_orders alter column customer_id drop identity if exists;
alter table if exists kfy_orders alter column customer_id drop default;
alter table if exists kfy_orders alter column customer_id type text using customer_id::text;

alter table if exists kfy_sales alter column customer_id drop identity if exists;
alter table if exists kfy_sales alter column customer_id drop default;
alter table if exists kfy_sales alter column customer_id type text using customer_id::text;

alter table if exists kfy_subscriptions alter column customer_id drop identity if exists;
alter table if exists kfy_subscriptions alter column customer_id drop default;
alter table if exists kfy_subscriptions alter column customer_id type text using customer_id::text;

alter table if exists kfy_enrollments alter column customer_id drop identity if exists;
alter table if exists kfy_enrollments alter column customer_id drop default;
alter table if exists kfy_enrollments alter column customer_id type text using customer_id::text;

alter table if exists kfy_products alter column id drop identity if exists;
alter table if exists kfy_products alter column id drop default;
alter table if exists kfy_products alter column id type text using id::text;
alter table if exists kfy_products drop constraint if exists kfy_products_pkey;
alter table if exists kfy_products add constraint kfy_products_pkey primary key (id);

alter table if exists kfy_sales alter column id drop identity if exists;
alter table if exists kfy_sales alter column id drop default;
alter table if exists kfy_sales alter column id type text using id::text;
alter table if exists kfy_sales drop constraint if exists kfy_sales_pkey;
alter table if exists kfy_sales add constraint kfy_sales_pkey primary key (id);

alter table if exists kfy_subscriptions alter column id drop identity if exists;
alter table if exists kfy_subscriptions alter column id drop default;
alter table if exists kfy_subscriptions alter column id type text using id::text;
alter table if exists kfy_subscriptions drop constraint if exists kfy_subscriptions_pkey;
alter table if exists kfy_subscriptions add constraint kfy_subscriptions_pkey primary key (id);

alter table if exists kfy_enrollments alter column id drop identity if exists;
alter table if exists kfy_enrollments alter column id drop default;
alter table if exists kfy_enrollments alter column id type text using id::text;
alter table if exists kfy_enrollments drop constraint if exists kfy_enrollments_pkey;
alter table if exists kfy_enrollments add constraint kfy_enrollments_pkey primary key (id);

alter table if exists kfy_coupons alter column id drop identity if exists;
alter table if exists kfy_coupons alter column id drop default;
alter table if exists kfy_coupons alter column id type text using id::text;
alter table if exists kfy_coupons drop constraint if exists kfy_coupons_pkey;
alter table if exists kfy_coupons add constraint kfy_coupons_pkey primary key (id);

alter table if exists kfy_refunds alter column id drop identity if exists;
alter table if exists kfy_refunds alter column id drop default;
alter table if exists kfy_refunds alter column id type text using id::text;
alter table if exists kfy_refunds drop constraint if exists kfy_refunds_pkey;
alter table if exists kfy_refunds add constraint kfy_refunds_pkey primary key (id);

alter table if exists kfy_payouts alter column id drop identity if exists;
alter table if exists kfy_payouts alter column id drop default;
alter table if exists kfy_payouts alter column id type text using id::text;
alter table if exists kfy_payouts drop constraint if exists kfy_payouts_pkey;
alter table if exists kfy_payouts add constraint kfy_payouts_pkey primary key (id);

alter table if exists kfy_orders
  add constraint kfy_orders_customer_id_fkey foreign key (customer_id) references kfy_customers(id);
alter table if exists kfy_sales
  add constraint kfy_sales_customer_id_fkey foreign key (customer_id) references kfy_customers(id);
alter table if exists kfy_subscriptions
  add constraint kfy_subscriptions_customer_id_fkey foreign key (customer_id) references kfy_customers(id);
alter table if exists kfy_enrollments
  add constraint kfy_enrollments_customer_id_fkey foreign key (customer_id) references kfy_customers(id);

commit;
