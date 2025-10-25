alter table kfy_products enable row level security;
alter table kfy_customers enable row level security;
alter table kfy_orders enable row level security;
alter table kfy_refunds enable row level security;
alter table kfy_enrollments enable row level security;
alter table kfy_coupons enable row level security;
alter table kfy_events enable row level security;
alter table kfy_tokens enable row level security;

create policy "Allow read for service role" on kfy_products for select using (auth.role() = 'service_role');
create policy "Allow read for service role" on kfy_customers for select using (auth.role() = 'service_role');
create policy "Allow read for service role" on kfy_orders for select using (auth.role() = 'service_role');
create policy "Allow read for service role" on kfy_refunds for select using (auth.role() = 'service_role');
create policy "Allow read for service role" on kfy_enrollments for select using (auth.role() = 'service_role');
create policy "Allow read for service role" on kfy_coupons for select using (auth.role() = 'service_role');
create policy "Allow read for service role" on kfy_events for select using (auth.role() = 'service_role');
create policy "Allow read for service role" on kfy_tokens for select using (auth.role() = 'service_role');

create policy "Allow write for service role" on kfy_products for all using (auth.role() = 'service_role');
create policy "Allow write for service role" on kfy_customers for all using (auth.role() = 'service_role');
create policy "Allow write for service role" on kfy_orders for all using (auth.role() = 'service_role');
create policy "Allow write for service role" on kfy_refunds for all using (auth.role() = 'service_role');
create policy "Allow write for service role" on kfy_enrollments for all using (auth.role() = 'service_role');
create policy "Allow write for service role" on kfy_coupons for all using (auth.role() = 'service_role');
create policy "Allow write for service role" on kfy_events for all using (auth.role() = 'service_role');
create policy "Allow write for service role" on kfy_tokens for all using (auth.role() = 'service_role');
