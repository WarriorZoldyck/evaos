DELETE FROM public.transactions
WHERE series_id IN (
  'e43023b9-71d9-4687-a94a-1b8ff22dcb37',
  '3fd4b6e0-f613-42cb-bd44-3109be7d63df',
  '6b337035-c762-44d9-a292-b1d5ad8f8806',
  '6432cfd5-4ba2-46d2-bb70-815203148ecb'
);

UPDATE public.transactions SET payment_date = DATE '2026-07-10' WHERE id = '8643356e-d963-45f3-ada8-d475043646df';
UPDATE public.transactions SET payment_date = DATE '2026-08-10' WHERE id = 'f8f06e61-7225-485f-b4b2-b61ac8f085d6';
UPDATE public.transactions SET payment_date = DATE '2026-09-10' WHERE id = 'a9b1cf65-ddf3-4056-b49f-851e1bba73db';