begin;

alter table if exists kfy_orders drop constraint if exists kfy_orders_product_id_fkey;
alter table if exists kfy_enrollments drop constraint if exists kfy_enrollments_product_id_fkey;

alter table if exists kfy_orders
  alter column product_id drop default,
  alter column product_id type text using product_id::text;

alter table if exists kfy_enrollments
  alter column product_id drop default,
  alter column product_id type text using product_id::text;

alter table kfy_products alter column id drop identity if exists;
alter table kfy_products alter column id type text using id::text;
alter table kfy_products alter column id drop default;

alter table if exists kfy_orders
  add constraint kfy_orders_product_id_fkey foreign key (product_id) references kfy_products(id);

alter table if exists kfy_enrollments
  add constraint kfy_enrollments_product_id_fkey foreign key (product_id) references kfy_products(id);

commit;
