UPDATE public.subscriptions
SET status='active',
    last_payment_at = '2026-05-18T12:00:00Z',
    current_period_end = '2027-05-18T23:59:59Z',
    next_due_date = '2027-05-18',
    grace_until = NULL,
    trial_ends_at = NULL
WHERE id = 'c0f58871-daab-421a-bbb1-d74739721ad7';