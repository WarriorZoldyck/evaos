UPDATE public.subscriptions
SET plan_id = '9ff71c27-476d-4884-86bb-9303c821e14f',
    status = 'active',
    is_beta = true,
    billing_cycle = 'yearly',
    current_period_end = now() + interval '10 years',
    next_due_date = (now() + interval '10 years')::date,
    canceled_at = NULL,
    grace_until = NULL,
    coupon_code = 'CORTESIA_EVA',
    discount_percent = 100,
    updated_at = now()
WHERE user_id = '163d8be1-b2fb-473a-9f91-865acf6a62ae';