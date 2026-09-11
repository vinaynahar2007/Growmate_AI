-- GrowMate AI: voice-friendly atomic khata operation.
-- One SQL function that creates/updates a customer khata and (optionally) an
-- initial transaction + items + stock update -- all in a single database call,
-- so a spoken command ("Rahul ka naya khata banao...") lands in one RPC.
--
-- Adapted from the reference to the schema in supabase/schema.sql:
--   * shop_id is text
--   * customers.outstanding_balance (no sales/last_visit/monthly_purchases table)
--   * transactions uses transaction_type/date/notes/payment_status
--   * transaction_items uses price
-- Safe to re-run: CREATE OR REPLACE FUNCTION.
--
-- Run this in the Supabase SQL editor (after supabase/schema.sql), or via the
-- migration tooling. Requires the base tables (`customers`, `transactions`,
-- `transaction_items`, `products`) from supabase/schema.sql.

create or replace function create_or_update_customer_khata(
  p_shop_id text,
  p_name text,
  p_father_name text default null,
  p_phone text default null,
  p_initial_type text default 'none',
  p_initial_amount numeric default 0,
  p_items jsonb default '[]'::jsonb,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer customers%rowtype;
  v_existing boolean := false;
  v_tx transactions%rowtype;
  v_tx_id text;
  v_items jsonb := '[]'::jsonb;
  v_total numeric := coalesce(p_initial_amount, 0);
  v_item jsonb;
  v_product products%rowtype;
  v_qty numeric;
  v_unit_price numeric;
  v_line_total numeric;
begin
  -- ---- validations (mirror the reference + app policy) ----
  if nullif(trim(p_name), '') is null then
    raise exception 'Customer name is required';
  end if;
  if p_initial_type not in ('none', 'credit', 'cash') then
    raise exception 'Invalid initial transaction type';
  end if;
  if coalesce(p_initial_amount, 0) < 0 then
    raise exception 'Initial amount cannot be negative';
  end if;
  if p_initial_type = 'credit' and coalesce(p_initial_amount, 0) <= 0 then
    raise exception 'Credit requires an exact amount greater than zero';
  end if;

  -- ---- upsert customer (never duplicate, case-insensitive) ----
  select * into v_customer
  from customers
  where shop_id = p_shop_id and lower(name) = lower(trim(p_name))
  limit 1
  for update;

  if found then
    v_existing := true;
    update customers
    set father_name = coalesce(nullif(trim(p_father_name), ''), father_name),
        phone = coalesce(nullif(trim(p_phone), ''), phone)
    where id = v_customer.id and shop_id = p_shop_id
    returning * into v_customer;
  else
    insert into customers(shop_id, name, father_name, phone, outstanding_balance)
    values (p_shop_id, trim(p_name), nullif(trim(p_father_name), ''), nullif(trim(p_phone), ''), 0)
    returning * into v_customer;
  end if;

  -- ---- optional initial transaction (credit = udhaar, cash = paid sale) ----
  if p_initial_type in ('credit', 'cash') then
    insert into transactions(shop_id, customer_id, date, amount, transaction_type, payment_status, notes)
    values (
      p_shop_id, v_customer.id, now(), v_total, p_initial_type,
      case when p_initial_type = 'cash' then 'paid' else 'pending' end,
      p_note
    )
    returning * into v_tx;
    v_tx_id := v_tx.id;

    for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
      v_qty := coalesce(nullif(v_item->>'quantity', '')::numeric, 0);
      if v_qty is null or v_qty <= 0 then
        continue;
      end if;
      v_unit_price := nullif(v_item->>'unit_price', '')::numeric;
      v_line_total := nullif(v_item->>'line_total', '')::numeric;

      select * into v_product
      from products
      where shop_id = p_shop_id and lower(name) = lower(v_item->>'product_name')
      limit 1;

      if v_product.id is not null then
        if v_unit_price is null then
          v_unit_price := v_product.price;
        end if;
        if v_line_total is null and v_unit_price is not null then
          v_line_total := v_qty * v_unit_price;
        end if;
        update products set quantity = greatest(0, quantity - v_qty)
        where id = v_product.id and shop_id = p_shop_id;
      end if;

      insert into transaction_items(transaction_id, product_id, product_name, quantity, unit, price)
      values (
        v_tx_id,
        case when v_product.id is null then null else v_product.id end,
        v_item->>'product_name', v_qty, coalesce(v_item->>'unit', 'units'), v_unit_price
      );

      v_items := v_items || jsonb_build_array(jsonb_build_object(
        'product_name', v_item->>'product_name',
        'quantity', v_qty,
        'unit', coalesce(v_item->>'unit', 'units'),
        'unit_price', v_unit_price,
        'line_total', v_line_total
      ));
    end loop;
  end if;

  -- ---- balances ----
  if p_initial_type = 'credit' and v_total > 0 then
    update customers
    set outstanding_balance = outstanding_balance + v_total
    where id = v_customer.id and shop_id = p_shop_id
    returning * into v_customer;
  end if;

  return jsonb_build_object(
    'success', true,
    'created', not v_existing,
    'customer', to_jsonb(v_customer),
    'transaction', case when v_tx.id is null then null else to_jsonb(v_tx) end,
    'items', v_items,
    'message',
      case when v_existing then 'Customer already exists; existing khata reused.'
           else 'Customer khata created.' end
  );
end;
$$;

-- Allow PostgREST RPC access with the publishable/anon/authenticated keys.
grant execute on function create_or_update_customer_khata(text, text, text, text, text, numeric, jsonb, text)
  to anon, authenticated, service_role;