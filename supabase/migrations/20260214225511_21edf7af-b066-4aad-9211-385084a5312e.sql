ALTER TABLE public.profiles
ADD COLUMN transaction_form_fields jsonb DEFAULT '{
  "supplier_client": true,
  "contact_name": false,
  "subcategories": true,
  "payment_method": true,
  "account_fields": true,
  "installments": true,
  "recurring": true,
  "notes": true,
  "barcode": false,
  "attachment_url": false
}'::jsonb;