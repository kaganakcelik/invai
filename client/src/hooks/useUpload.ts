import { useState, useCallback } from 'react';
import { uploadInvoice } from '../api/invoices';

type UploadStatus = 'idle' | 'uploading' | 'polling' | 'success' | 'error';

export function useUpload() {
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const upload = useCallback(
    async (file: File, locationId: string, vendorId: string) => {
      setStatus('uploading');
      setError(null);
      setInvoiceId(null);

      try {
        const { invoice_id } = await uploadInvoice(file, locationId, vendorId);
        setInvoiceId(invoice_id);
        setStatus('success');
      } catch (err: unknown) {
        const msg =
          err instanceof Error ? err.message : 'Upload failed';
        setError(msg);
        setStatus('error');
      }
    },
    []
  );

  const reset = useCallback(() => {
    setStatus('idle');
    setInvoiceId(null);
    setError(null);
  }, []);

  return { status, invoiceId, error, upload, reset };
}
