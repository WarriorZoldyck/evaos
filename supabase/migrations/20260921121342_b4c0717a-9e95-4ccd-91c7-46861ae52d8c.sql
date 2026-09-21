insert into public.subscription_coupons (code, description, discount_type, discount_value, max_uses, is_active, expires_at, applies_to_cycle)
values ('EVAVITALICIO100','Cortesia vitalicia 100% - uso unico','percent',100,1,true,null,'both')
on conflict (code) do nothing;