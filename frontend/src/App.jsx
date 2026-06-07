import { useState, useEffect, useCallback } from 'react';
import { fetchImages, fetchImage, uploadImages, deleteImage, applyEdit, revertToStep, getImageUrl, getProcessedUrl } from './api/client.js';
import Library from './components/Library.jsx';
import Editor from './components/Editor.jsx';
import UploadZone from './components/UploadZone.jsx';
import { Layers, Upload, Menu } from 'lucide-react';

export default function App() {
  const [images, setImages] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [currentFile, setCurrentFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [sidebarTab, setSidebarTab] = useState('library');
  const [sidebarOpen, setSidebarOpen] = useState(false); // mobile drawer

  const loadImages = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchImages();
      setImages(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadImages(); }, [loadImages]);

  const selectImage = useCallback(async (img) => {
    setSelectedId(img.id);
    setSidebarOpen(false); // close the drawer on mobile after picking an image
    // Load the edit history that was persisted in SQLite so undo/redo and the
    // current edited view survive switching images AND a full page refresh.
    const full = await fetchImage(img.id); // { ...image, history: [...] }
    const history = (full.history || []).map((h) => ({
      operation: h.operation,
      // params is stored as a JSON string in the DB — parse it back to an object.
      params: typeof h.params === 'string' ? JSON.parse(h.params) : h.params,
      resultFilename: h.result_filename,
    }));
    // Start positioned at the most recent step (or -1 = original if no edits).
    const historyIndex = history.length - 1;
    setCurrentFile({
      image: img,
      url:
        historyIndex < 0
          ? getImageUrl(img)
          : getProcessedUrl(history[historyIndex].resultFilename),
      history,           // [{ operation, params, resultFilename }]
      historyIndex,      // -1 = showing original
    });
  }, []);

  // Apply a new edit operation
  const handleEdit = useCallback(async (operation, params) => {
    if (!currentFile) return;
    setProcessing(true);
    try {
      const nextIndex = currentFile.historyIndex + 1;
      const result = await applyEdit(currentFile.image.id, operation, params, nextIndex);

      // Trim any redo-branch steps that are now invalidated
      const trimmed = currentFile.history.slice(0, currentFile.historyIndex + 1);
      const newHistory = [...trimmed, { operation, params, resultFilename: result.resultFilename }];

      setCurrentFile(prev => ({
        ...prev,
        url: getProcessedUrl(result.resultFilename),
        history: newHistory,
        historyIndex: nextIndex,
      }));
    } catch (e) {
      console.error('Edit failed:', e);
    } finally {
      setProcessing(false);
    }
  }, [currentFile]);

  // Undo: move back one step and re-render at that point
  const handleUndo = useCallback(async () => {
    if (!currentFile || currentFile.historyIndex < 0) return;
    setProcessing(true);
    try {
      const nextIndex = currentFile.historyIndex - 1;
      const result = await revertToStep(currentFile.image.id, nextIndex);

      setCurrentFile(prev => ({
        ...prev,
        url: nextIndex < 0 ? getImageUrl(prev.image) : getProcessedUrl(result.resultFilename),
        historyIndex: nextIndex,
      }));
    } catch (e) {
      console.error('Undo failed:', e);
    } finally {
      setProcessing(false);
    }
  }, [currentFile]);

  // Redo: move forward one step using the already-stored resultFilename
  const handleRedo = useCallback(async () => {
    if (!currentFile || currentFile.historyIndex >= currentFile.history.length - 1) return;
    setProcessing(true);
    try {
      const nextIndex = currentFile.historyIndex + 1;
      // Use the cached resultFilename from our history array — no new backend call needed
      const cached = currentFile.history[nextIndex]?.resultFilename;
      if (cached) {
        setCurrentFile(prev => ({
          ...prev,
          url: getProcessedUrl(cached),
          historyIndex: nextIndex,
        }));
        setProcessing(false);
        return;
      }
      // Fallback: ask backend to re-render (shouldn't usually be needed)
      const result = await revertToStep(currentFile.image.id, nextIndex);
      setCurrentFile(prev => ({
        ...prev,
        url: getProcessedUrl(result.resultFilename),
        historyIndex: nextIndex,
      }));
    } catch (e) {
      console.error('Redo failed:', e);
    } finally {
      setProcessing(false);
    }
  }, [currentFile]);

  const handleUpload = useCallback(async (files) => {
    setProcessing(true);
    try {
      await uploadImages(files);
      await loadImages();
      setSidebarTab('library');
    } catch (e) {
      console.error('Upload failed:', e);
    } finally {
      setProcessing(false);
    }
  }, [loadImages]);

  const handleDelete = useCallback(async (id) => {
    try {
      await deleteImage(id);
      if (selectedId === id) {
        setSelectedId(null);
        setCurrentFile(null);
      }
      await loadImages();
    } catch (e) {
      console.error('Delete failed:', e);
    }
  }, [selectedId, loadImages]);

  return (
    <div className="d-flex overflow-hidden bg-ink-900 text-ink-50" style={{ height: '100vh' }}>
      {/* Mobile drawer backdrop */}
      {sidebarOpen && (
        <div className="sidebar-backdrop d-lg-none" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`app-sidebar d-flex flex-column bg-ink-900 ${sidebarOpen ? 'open' : ''}`}>
        {/* Logo */}
        <div className="px-4 py-3 border-bottom border-ink-800 d-flex align-items-baseline gap-2">
          <span className="text-accent font-mono fw-medium fs-5">pixl</span>
          <span className="text-ink-600 font-mono" style={{ fontSize: '.7rem' }}>editor</span>
        </div>

        {/* Tabs */}
        <div className="d-flex border-bottom border-ink-800">
          <button
            onClick={() => setSidebarTab('library')}
            className={`tab-btn flex-fill d-flex align-items-center justify-content-center gap-1 py-2 small fw-medium ${sidebarTab === 'library' ? 'active' : ''}`}
          >
            <Layers size={13} /> Library
          </button>
          <button
            onClick={() => setSidebarTab('upload')}
            className={`tab-btn flex-fill d-flex align-items-center justify-content-center gap-1 py-2 small fw-medium ${sidebarTab === 'upload' ? 'active' : ''}`}
          >
            <Upload size={13} /> Upload
          </button>
        </div>

        {/* Sidebar content */}
        <div className="flex-grow-1 overflow-auto">
          {sidebarTab === 'library' ? (
            <Library images={images} selectedId={selectedId} onSelect={selectImage} onDelete={handleDelete} loading={loading} />
          ) : (
            <UploadZone onUpload={handleUpload} processing={processing} />
          )}
        </div>
      </aside>

      {/* Main column */}
      <div className="d-flex flex-column flex-grow-1 overflow-hidden">
        {/* Mobile top bar (hamburger) — hidden on lg+ where the sidebar is static */}
        <div className="d-lg-none d-flex align-items-center gap-2 px-3 py-2 border-bottom border-ink-800 bg-ink-900 flex-shrink-0">
          <button className="btn btn-ink btn-sm p-1" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
            <Menu size={18} />
          </button>
          <span className="text-accent font-mono fw-medium">pixl</span>
          <span className="text-ink-600 font-mono" style={{ fontSize: '.7rem' }}>editor</span>
        </div>

        <main className="flex-grow-1 overflow-hidden">
          {currentFile ? (
            <Editor
              currentFile={currentFile}
              onEdit={handleEdit}
              onUndo={handleUndo}
              onRedo={handleRedo}
              processing={processing}
              canUndo={currentFile.historyIndex >= 0}
              canRedo={currentFile.historyIndex < currentFile.history.length - 1}
            />
          ) : (
            <EmptyState onUploadClick={() => { setSidebarTab('upload'); setSidebarOpen(true); }} />
          )}
        </main>
      </div>
    </div>
  );
}

function EmptyState({ onUploadClick }) {
  return (
    <div className="d-flex flex-column align-items-center justify-content-center h-100 gap-3 text-center px-4">
      <div className="rounded-4 bg-ink-800 d-flex align-items-center justify-content-center mb-2" style={{ width: 96, height: 96 }}>
        <span style={{ fontSize: '2.25rem' }}>🖼️</span>
      </div>
      <h2 className="fs-4 fw-medium text-ink-100">No image selected</h2>
      <p className="text-ink-400 small" style={{ maxWidth: 320 }}>
        Upload images and select one from the library to start editing.
      </p>
      <button onClick={onUploadClick} className="btn btn-accent mt-2">
        Upload images
      </button>
    </div>
  );
}
