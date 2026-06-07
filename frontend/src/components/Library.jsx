import { Trash2 } from 'lucide-react';
import { getImageUrl } from '../api/client.js';

export default function Library({ images, selectedId, onSelect, onDelete, loading }) {
  if (loading) {
    return (
      <div className="p-3 d-flex flex-column gap-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="rounded bg-ink-800 placeholder-wave" style={{ height: 64 }}>
            <span className="placeholder col-12 h-100 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (!images.length) {
    return (
      <div className="p-4 text-center text-ink-400 small mt-3">
        No images yet. Upload some to get started.
      </div>
    );
  }

  return (
    <div className="p-2 d-flex flex-column gap-1">
      {images.map(img => (
        <div
          key={img.id}
          onClick={() => onSelect(img)}
          className={`lib-item d-flex align-items-center gap-2 p-2 rounded ${selectedId === img.id ? 'selected' : ''}`}
        >
          
          <div className="flex-shrink-0 rounded overflow-hidden bg-ink-700" style={{ width: 44, height: 44 }}>
            <img
              src={getImageUrl(img)}
              alt={img.original_name}
              className="w-100 h-100"
              style={{ objectFit: 'cover' }}
            />
          </div>

          
          <div className="flex-grow-1 min-w-0">
            <p className="small fw-medium text-ink-100 text-truncate mb-0">{img.original_name}</p>
            <p className="text-ink-400 font-mono mb-0" style={{ fontSize: '.7rem' }}>
              {img.width}×{img.height}
            </p>
          </div>

          
          <button
            onClick={e => { e.stopPropagation(); onDelete(img.id); }}
            className="delete-btn btn btn-sm border-0 p-1"
          >
            <Trash2 size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}
