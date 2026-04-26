import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const BUCKET = "whatsapp-attachments";
const STORAGE_URI_PREFIX = `supabase://${BUCKET}/`;
const PUBLIC_PATH_MARKER = `/storage/v1/object/public/${BUCKET}/`;
const SIGNED_PATH_MARKER = `/storage/v1/object/sign/${BUCKET}/`;

function extractAttachmentPath(value: string | null | undefined) {
  if (!value) return null;

  if (value.startsWith(STORAGE_URI_PREFIX)) {
    return value.slice(STORAGE_URI_PREFIX.length).split("?")[0];
  }

  const marker = value.includes(PUBLIC_PATH_MARKER) ? PUBLIC_PATH_MARKER : value.includes(SIGNED_PATH_MARKER) ? SIGNED_PATH_MARKER : null;
  if (!marker) return null;

  return decodeURIComponent(value.split(marker)[1]?.split("?")[0] || "") || null;
}

export function useSignedAttachmentUrl(attachmentUrl: string | null | undefined) {
  const [signedUrl, setSignedUrl] = useState<string | null>(attachmentUrl || null);

  useEffect(() => {
    let cancelled = false;
    const path = extractAttachmentPath(attachmentUrl);

    if (!attachmentUrl || !path) {
      setSignedUrl(attachmentUrl || null);
      return;
    }

    supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, 60 * 60)
      .then(({ data, error }) => {
        if (!cancelled) setSignedUrl(error ? null : data?.signedUrl || null);
      });

    return () => {
      cancelled = true;
    };
  }, [attachmentUrl]);

  return signedUrl;
}