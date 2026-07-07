import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileDropzone } from '../components/FileDropzone';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { CustomSelect } from '../components/CustomSelect';
import { getLocations, createLocation, deleteLocation } from '../api/locations';
import { getVendors, createVendor, deleteVendor } from '../api/vendors';
import { uploadInvoice, getInvoice } from '../api/invoices';

export function UploadPage() {
  const qc = useQueryClient();
  const [files, setFiles] = useState<File[]>([]);
  const [locationId, setLocationId] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newVendor, setNewVendor] = useState('');
  const [uploadedId, setUploadedId] = useState<string | null>(null);
  const [pollCount, setPollCount] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const locations = useQuery({ queryKey: ['locations'], queryFn: getLocations });
  const vendors = useQuery({ queryKey: ['vendors'], queryFn: getVendors });

  const invoiceStatus = useQuery({
    queryKey: ['invoice', uploadedId],
    queryFn: () => getInvoice(uploadedId!),
    enabled: !!uploadedId,
    refetchInterval: (data) => {
      const status = data?.state?.data?.invoice?.status;
      if (status === 'parsed' || status === 'failed') return false;
      if (pollCount >= 30) return false;
      return 2000;
    },
  });

  useEffect(() => {
    if (uploadedId && invoiceStatus.data?.invoice.status === 'pending') {
      setPollCount((c) => c + 1);
    }
  }, [uploadedId, invoiceStatus.data]);

  const addLocation = useMutation({
    mutationFn: () => createLocation(newLocation.trim()),
    onSuccess: (loc) => {
      qc.invalidateQueries({ queryKey: ['locations'] });
      setLocationId(loc.id);
      setNewLocation('');
    },
  });

  const addVendor = useMutation({
    mutationFn: () => createVendor(newVendor.trim()),
    onSuccess: (v) => {
      qc.invalidateQueries({ queryKey: ['vendors'] });
      setVendorId(v.id);
      setNewVendor('');
    },
  });

  const removeLocation = useMutation({
    mutationFn: (id: string) => deleteLocation(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['locations'] });
      if (locationId === id) setLocationId('');
    },
  });

  const removeVendor = useMutation({
    mutationFn: (id: string) => deleteVendor(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['vendors'] });
      if (vendorId === id) setVendorId('');
    },
  });

  const uploadMutation = useMutation({
    mutationFn: () => uploadInvoice(files[0], locationId, vendorId),
    onSuccess: (data) => {
      setUploadedId(data.invoice_id);
      setPollCount(0);
      setUploadError(null);
      qc.invalidateQueries({ queryKey: ['invoices'] });
    },
    onError: (err: Error) => {
      setUploadError(err.message ?? 'Upload failed');
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setUploadError(null);
    setUploadedId(null);
    uploadMutation.mutate();
  }

  function handleReset() {
    setFiles([]);
    setUploadedId(null);
    setPollCount(0);
    setUploadError(null);
    uploadMutation.reset();
  }

  const invoiceResult = uploadedId ? invoiceStatus.data?.invoice : null;

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Upload Invoice</div>
        <div className="page-subtitle">Upload a PDF or image invoice to extract and analyze pricing</div>
      </div>

      {uploadError && <div className="alert alert-error">{uploadError}</div>}

      {!uploadedId ? (
        <div className="card" style={{ maxWidth: 600 }}>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Location</label>
              <CustomSelect
                value={locationId}
                onChange={setLocationId}
                options={(locations.data ?? []).map((l) => ({ value: l.id, label: l.name }))}
                placeholder="Select a location…"
                required
                onDelete={(id) => removeLocation.mutate(id)}
              />
              <div className="flex gap-8 mt-16" style={{ marginTop: 8 }}>
                <input
                  type="text"
                  placeholder="New location name"
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  style={{ width: 'auto', flex: 1 }}
                />
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={!newLocation.trim() || addLocation.isPending}
                  onClick={() => addLocation.mutate()}
                >
                  Add
                </button>
              </div>
            </div>

            <div className="form-group">
              <label>Vendor / Distributor</label>
              <CustomSelect
                value={vendorId}
                onChange={setVendorId}
                options={(vendors.data ?? []).map((v) => ({ value: v.id, label: v.name }))}
                placeholder="Select a vendor…"
                required
                onDelete={(id) => removeVendor.mutate(id)}
              />
              <div className="flex gap-8" style={{ marginTop: 8 }}>
                <input
                  type="text"
                  placeholder="New vendor name"
                  value={newVendor}
                  onChange={(e) => setNewVendor(e.target.value)}
                  style={{ width: 'auto', flex: 1 }}
                />
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={!newVendor.trim() || addVendor.isPending}
                  onClick={() => addVendor.mutate()}
                >
                  Add
                </button>
              </div>
            </div>

            <div className="form-group">
              <label>Invoice File</label>
              <FileDropzone files={files} onFiles={setFiles} />
            </div>

            <div style={{ textAlign: 'center', marginTop: 8 }}>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!files.length || !locationId || !vendorId || uploadMutation.isPending}
            >
              {uploadMutation.isPending ? 'Uploading…' : 'Upload & Analyze'}
            </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="card" style={{ maxWidth: 600 }}>
          {invoiceResult?.status === 'pending' && (
            <div className="status-polling">
              <span className="spinner-dot" />
              Extracting line items with Gemini… this takes a few seconds.
            </div>
          )}

          {invoiceResult?.status === 'parsed' && (
            <>
              <div className="alert alert-success">
                Invoice parsed successfully!{' '}
                {invoiceStatus.data && (
                  <>
                    Found {invoiceStatus.data.line_items.length} line items,{' '}
                    {invoiceStatus.data.price_flags.length} price flags.
                  </>
                )}
              </div>
              <div className="flex gap-8 mt-16">
                <Link to={`/invoices/${uploadedId}`} className="btn btn-primary">
                  View Invoice Detail
                </Link>
                <button className="btn btn-secondary" onClick={handleReset}>
                  Upload Another
                </button>
              </div>
            </>
          )}

          {invoiceResult?.status === 'failed' && (
            <>
              <div className="alert alert-error">
                Extraction failed. Gemini could not parse this invoice. You can retry or upload a clearer file.
              </div>
              <div className="flex gap-8 mt-16">
                <Link to={`/invoices/${uploadedId}`} className="btn btn-secondary">
                  View Invoice
                </Link>
                <button className="btn btn-secondary" onClick={handleReset}>
                  Upload Another
                </button>
              </div>
            </>
          )}

          {!invoiceResult && invoiceStatus.isLoading && <LoadingSpinner />}
        </div>
      )}
    </div>
  );
}
