import { useDropzone } from 'react-dropzone';

interface FileDropzoneProps {
  onFiles: (files: File[]) => void;
  files: File[];
}

export function FileDropzone({ onFiles, files }: FileDropzoneProps) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
    },
    onDrop: onFiles,
    multiple: false,
  });

  return (
    <div {...getRootProps()} className={`dropzone ${isDragActive ? 'active' : ''}`}>
      <input {...getInputProps()} />
      <div className="dropzone-text">
        {isDragActive ? (
          <p>Drop the file here</p>
        ) : (
          <p>
            <strong>Click to upload</strong> or drag and drop
            <br />
            <span style={{ fontSize: 12 }}>PDF, JPG, PNG, WEBP — max 20 MB</span>
          </p>
        )}
      </div>
      {files.length > 0 && (
        <div className="dropzone-files">
          {files.map((f) => (
            <span key={f.name} className="dropzone-file-chip">
              {f.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
