alter table kfy_products alter column id drop identity if exists;
alter table kfy_products alter column id type text using id::text;
alter table kfy_products alter column id drop default;
