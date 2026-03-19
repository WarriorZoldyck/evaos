-- First clean the duplicate whatsapp_number
UPDATE profiles SET whatsapp_number = NULL 
WHERE id IN ('9b5a3c7c-781d-4826-aa0d-59b5a7f5a883', '673ade6e-570a-4fbe-988a-2917a9c6933e');

-- Now create the unique index to prevent future duplicates
CREATE UNIQUE INDEX unique_whatsapp_number ON profiles (whatsapp_number) WHERE whatsapp_number IS NOT NULL;