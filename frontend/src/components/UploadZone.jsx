import { useState, useRef } from 'react';
import { ImagePlus } from 'lucide-react';

export default function UploadZone({ onUpload, processing }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef();

  const handle = (files) => {
    if (!files?.length) return;
    onUpload(Array.from(files));
  };

  return (
    <div className="p-3 d-flex flex-column gap-3">
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); handle(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        className={`dropzone rounded-3 p-4 d-flex flex-column align-items-center gap-3 ${dragging ? 'dragging' : ''}`}
      >
        <div
          className={`rounded-circle d-flex align-items-center justify-content-center ${dragging ? 'bg-accent text-ink-900' : 'bg-ink-800 text-ink-400'}`}
          style={{ width: 40, height: 40 }}
        >
          <ImagePlus size={18} />
        </div>
        <div className="text-center">
          <p className="small fw-medium text-ink-100 mb-0">Drop images here</p>
          <p className="small text-ink-400 mb-0">or click to browse</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*"
          className="d-none"
          onChange={e => handle(e.target.files)}
        />
      </div>

      {processing && (
        <div className="d-flex align-items-center justify-content-center gap-2 small text-ink-400 py-2">
          <span className="spinner-border spinner-border-sm text-accent" role="status" />
          Uploading…
        </div>
      )}

      <p className="small text-ink-400 text-center mb-0">
        Supports JPG, PNG, WebP · Max 20MB each
      </p>
    </div>
  );
}
