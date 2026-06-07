import { useState, useRef, useEffect, useCallback } from 'react';
import { Stage, Layer, Image as KonvaImage, Rect, Transformer } from 'react-konva';
import {
  Undo2, Redo2, Download, Crop, Sliders,
  RotateCcw, RotateCw, FlipHorizontal, FlipVertical,
  Loader2, CheckCircle, XCircle
} from 'lucide-react';

const TOOLS = [
  { id: 'crop', label: 'Crop', icon: Crop },
  { id: 'blur', label: 'Blur', icon: Sliders },
  { id: 'sharpen', label: 'Sharpen', icon: Sliders },
];

export default function Editor({ currentFile, onEdit, onUndo, onRedo, processing, canUndo, canRedo }) {
  const [tool, setTool] = useState(null);
  const [imgEl, setImgEl] = useState(null);
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });
  const [imgDisplay, setImgDisplay] = useState({ x: 0, y: 0, width: 0, height: 0, scale: 1, naturalW: 0, naturalH: 0 });
  const [cropRect, setCropRect] = useState(null);
  const [blurValue, setBlurValue] = useState(3);
  const [sharpenValue, setSharpenValue] = useState(1);
  const [notification, setNotification] = useState(null);

  const containerRef = useRef();
  const stageRef = useRef();
  const cropRectRef = useRef();
  const transformerRef = useRef();

  useEffect(() => {
    setImgEl(null);
    const el = new window.Image();
    el.crossOrigin = 'anonymous';
    el.src = currentFile.url + '?t=' + Date.now();
    el.onload = () => setImgEl(el);
  }, [currentFile.url]);


  const fitImage = useCallback(() => {
    if (!imgEl || !containerRef.current) return;
    const { clientWidth: cw, clientHeight: ch } = containerRef.current;
    if (!cw || !ch) return;
    const scale = Math.min(cw / imgEl.naturalWidth, ch / imgEl.naturalHeight, 1) * 0.88;
    const w = imgEl.naturalWidth * scale;
    const h = imgEl.naturalHeight * scale;
    setStageSize({ width: cw, height: ch });
    setImgDisplay({
      x: (cw - w) / 2,
      y: (ch - h) / 2,
      width: w,
      height: h,
      scale,
      naturalW: imgEl.naturalWidth,
      naturalH: imgEl.naturalHeight,
    });
  }, [imgEl]);


  useEffect(() => { fitImage(); }, [fitImage]);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const ro = new ResizeObserver(() => fitImage());
    ro.observe(node);
    return () => ro.disconnect();
  }, [fitImage]);

  useEffect(() => {
    if (tool === 'crop' && imgDisplay.width > 0) {
      const pad = Math.min(imgDisplay.width, imgDisplay.height) * 0.1;
      setCropRect({
        x: imgDisplay.x + pad,
        y: imgDisplay.y + pad,
        width: imgDisplay.width - pad * 2,
        height: imgDisplay.height - pad * 2,
      });
    } else {
      setCropRect(null);
    }
  }, [tool]); 


  useEffect(() => {
    if (tool === 'crop' && cropRect && transformerRef.current) {
      const attach = () => {
        if (cropRectRef.current) {
          transformerRef.current.nodes([cropRectRef.current]);
          transformerRef.current.getLayer()?.batchDraw();
        }
      };
      const raf = requestAnimationFrame(attach);
      return () => cancelAnimationFrame(raf);
    }
  }, [tool, cropRect]);

  const showNotification = (type, msg) => {
    setNotification({ type, msg });
    setTimeout(() => setNotification(null), 2800);
  };

  
  const handleApplyCrop = useCallback(async () => {
    if (!cropRect || !imgDisplay.width) return;

    
    const { scale, x: ox, y: oy, naturalW, naturalH } = imgDisplay;

    
    const canvasLeft = Math.max(imgDisplay.x, cropRect.x);
    const canvasTop  = Math.max(imgDisplay.y, cropRect.y);
    const canvasRight  = Math.min(imgDisplay.x + imgDisplay.width,  cropRect.x + cropRect.width);
    const canvasBottom = Math.min(imgDisplay.y + imgDisplay.height, cropRect.y + cropRect.height);

    const params = {
      x:      Math.round((canvasLeft - ox) / scale),
      y:      Math.round((canvasTop  - oy) / scale),
      width:  Math.round((canvasRight  - canvasLeft) / scale),
      height: Math.round((canvasBottom - canvasTop)  / scale),
    };

    
    if (params.x < 0) { params.width  += params.x; params.x = 0; }
    if (params.y < 0) { params.height += params.y; params.y = 0; }
    params.width  = Math.min(params.width,  naturalW - params.x);
    params.height = Math.min(params.height, naturalH - params.y);

    if (params.width < 2 || params.height < 2) return;

    await onEdit('crop', params);
    setTool(null);
    showNotification('success', 'Crop applied');
  }, [cropRect, imgDisplay, onEdit]);

  
  const handleApplyBlur = useCallback(async () => {
    await onEdit('blur', { sigma: blurValue });
    showNotification('success', `Blur applied (σ = ${blurValue})`);
  }, [blurValue, onEdit]);

  const handleApplySharpen = useCallback(async () => {
    await onEdit('sharpen', { sigma: sharpenValue });
    showNotification('success', 'Sharpen applied');
  }, [sharpenValue, onEdit]);

  
  const handleRotate = useCallback(async () => {
    await onEdit('rotate', { angle: 90 });
    showNotification('success', 'Rotated 90°');
  }, [onEdit]);

  const handleFlip = useCallback(async (direction) => {
    await onEdit('flip', { direction });
    showNotification('success', `Flipped ${direction === 'horizontal' ? 'horizontally' : 'vertically'}`);
  }, [onEdit]);


  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = currentFile.url;
    link.download = `edited_${currentFile.image.original_name}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const historyLabels = currentFile.history.map((h, i) => ({
    label: h.operation,
    active: i <= currentFile.historyIndex,
    current: i === currentFile.historyIndex,
  }));

  return (
    <div className="d-flex flex-column h-100">

      {/* ── Top toolbar ────────────────────────────────────── */}
      <div className="d-flex flex-wrap align-items-center gap-2 px-3 py-2 border-bottom border-ink-800 bg-ink-900 flex-shrink-0">
        <span className="small text-ink-400 font-mono text-truncate" style={{ maxWidth: 180 }}>
          {currentFile.image.original_name}
        </span>
        {imgDisplay.naturalW > 0 && (
          <span className="small text-ink-600 font-mono">
            {imgDisplay.naturalW}×{imgDisplay.naturalH}
          </span>
        )}

        <div className="flex-grow-1" />

        
        <button onClick={onUndo} disabled={!canUndo || processing}
          className="btn btn-ink btn-sm p-1 rounded" title="Undo">
          <Undo2 size={15} />
        </button>
        <button onClick={onRedo} disabled={!canRedo || processing}
          className="btn btn-ink btn-sm p-1 rounded" title="Redo">
          <Redo2 size={15} />
        </button>

        <span className="vr-ink" />

        
        <button onClick={handleRotate} disabled={processing}
          className="btn btn-ink btn-sm p-1 rounded" title="Rotate 90° clockwise">
          <RotateCw size={15} />
        </button>
        <button onClick={() => handleFlip('horizontal')} disabled={processing}
          className="btn btn-ink btn-sm p-1 rounded" title="Flip horizontal">
          <FlipHorizontal size={15} />
        </button>
        <button onClick={() => handleFlip('vertical')} disabled={processing}
          className="btn btn-ink btn-sm p-1 rounded" title="Flip vertical">
          <FlipVertical size={15} />
        </button>

        <span className="vr-ink" />

        
        {TOOLS.map(({ id, label, icon: Icon }) => (
          <button key={id}
            onClick={() => setTool(tool === id ? null : id)}
            className={`btn btn-sm d-flex align-items-center gap-1 ${tool === id ? 'btn-accent' : 'btn-ink'}`}>
            <Icon size={12} /> {label}
          </button>
        ))}

        <span className="vr-ink" />

        <button onClick={handleDownload}
          className="btn btn-sm btn-ink bg-ink-800 text-ink-100 d-flex align-items-center gap-1">
          <Download size={12} /> Export
        </button>
      </div>

      
      {tool && (
        <div className="d-flex flex-wrap align-items-center gap-2 px-3 py-2 border-bottom border-ink-800 bg-ink-800 flex-shrink-0">

          {tool === 'crop' && (
            <>
              <span className="small text-ink-400">Drag handles to adjust the crop area, then click Apply</span>
              <div className="flex-grow-1" />
              <button onClick={() => setTool(null)}
                className="btn btn-sm btn-ink d-flex align-items-center gap-1">
                <XCircle size={13} /> Cancel
              </button>
              <button onClick={handleApplyCrop} disabled={processing}
                className="btn btn-sm btn-accent d-flex align-items-center gap-1">
                {processing ? <Loader2 size={12} className="spin" /> : <CheckCircle size={12} />}
                Apply Crop
              </button>
            </>
          )}

          {tool === 'blur' && (
            <>
              <span className="small text-ink-400 flex-shrink-0" style={{ width: 48 }}>Blur</span>
              <input type="range" min="0.5" max="20" step="0.5"
                value={blurValue}
                onChange={e => setBlurValue(parseFloat(e.target.value))}
                className="flex-grow-1" style={{ maxWidth: 224 }} />
              <span className="small font-mono text-accent text-end" style={{ width: 40 }}>{blurValue.toFixed(1)}</span>
              <div className="flex-grow-1" />
              <button onClick={() => setTool(null)}
                className="btn btn-sm btn-ink d-flex align-items-center gap-1">
                <XCircle size={13} /> Cancel
              </button>
              <button onClick={handleApplyBlur} disabled={processing}
                className="btn btn-sm btn-accent d-flex align-items-center gap-1">
                {processing ? <Loader2 size={12} className="spin" /> : <CheckCircle size={12} />}
                Apply Blur
              </button>
            </>
          )}

          {tool === 'sharpen' && (
            <>
              <span className="small text-ink-400 flex-shrink-0" style={{ width: 64 }}>Sharpen</span>
              <input type="range" min="0.5" max="5" step="0.1"
                value={sharpenValue}
                onChange={e => setSharpenValue(parseFloat(e.target.value))}
                className="flex-grow-1" style={{ maxWidth: 224 }} />
              <span className="small font-mono text-accent text-end" style={{ width: 40 }}>{sharpenValue.toFixed(1)}</span>
              <div className="flex-grow-1" />
              <button onClick={() => setTool(null)}
                className="btn btn-sm btn-ink d-flex align-items-center gap-1">
                <XCircle size={13} /> Cancel
              </button>
              <button onClick={handleApplySharpen} disabled={processing}
                className="btn btn-sm btn-accent d-flex align-items-center gap-1">
                {processing ? <Loader2 size={12} className="spin" /> : <CheckCircle size={12} />}
                Apply Sharpen
              </button>
            </>
          )}

        </div>
      )}

      
      <div ref={containerRef} className="flex-grow-1 position-relative overflow-hidden canvas-area">
        {/* Checkerboard */}
        <div className="position-absolute top-0 start-0 w-100 h-100 checkerboard" style={{ pointerEvents: 'none' }} />

        {imgEl && (
          <Stage ref={stageRef} width={stageSize.width} height={stageSize.height}
            style={{ position: 'absolute', top: 0, left: 0 }}>
            <Layer>
              {/* The image */}
              <KonvaImage
                image={imgEl}
                x={imgDisplay.x}
                y={imgDisplay.y}
                width={imgDisplay.width}
                height={imgDisplay.height}
              />

              
              {tool === 'crop' && cropRect && (() => {
                const { x: ix, y: iy, width: iw, height: ih } = imgDisplay;
                const { x: cx, y: cy, width: cw, height: ch } = cropRect;
                return (
                  <>
                    
                    <Rect x={ix} y={iy} width={iw} height={cy - iy}             fill="rgba(0,0,0,0.55)" listening={false} />
                    <Rect x={ix} y={cy + ch} width={iw} height={iy + ih - cy - ch} fill="rgba(0,0,0,0.55)" listening={false} />
                    <Rect x={ix} y={cy} width={cx - ix} height={ch}             fill="rgba(0,0,0,0.55)" listening={false} />
                    <Rect x={cx + cw} y={cy} width={ix + iw - cx - cw} height={ch} fill="rgba(0,0,0,0.55)" listening={false} />

                    
                    <Rect
                      ref={cropRectRef}
                      x={cropRect.x} y={cropRect.y}
                      width={cropRect.width} height={cropRect.height}
                      fill="rgba(232,255,71,0.05)"
                      stroke="#e8ff47"
                      strokeWidth={1.5}
                      draggable
                      onDragMove={e => {
                        const node = e.target;
                        const newX = Math.max(imgDisplay.x, Math.min(node.x(), imgDisplay.x + imgDisplay.width - cropRect.width));
                        const newY = Math.max(imgDisplay.y, Math.min(node.y(), imgDisplay.y + imgDisplay.height - cropRect.height));
                        node.x(newX);
                        node.y(newY);
                      }}
                      onDragEnd={e => {
                        setCropRect(prev => ({ ...prev, x: e.target.x(), y: e.target.y() }));
                      }}
                      onTransformEnd={() => {
                        const node = cropRectRef.current;
                        const newW = Math.max(10, node.width() * node.scaleX());
                        const newH = Math.max(10, node.height() * node.scaleY());
                        node.scaleX(1);
                        node.scaleY(1);
                        node.width(newW);
                        node.height(newH);
                        setCropRect({ x: node.x(), y: node.y(), width: newW, height: newH });
                      }}
                    />
                    <Transformer
                      ref={transformerRef}
                      rotateEnabled={false}
                      keepRatio={false}
                      borderStroke="#e8ff47"
                      borderStrokeWidth={1.5}
                      anchorStroke="#e8ff47"
                      anchorFill="#111"
                      anchorSize={9}
                      anchorCornerRadius={2}
                      boundBoxFunc={(oldBox, newBox) => {
                        if (newBox.width < 10 || newBox.height < 10) return oldBox;
                        return newBox;
                      }}
                    />
                  </>
                );
              })()}
            </Layer>
          </Stage>
        )}

        
        {!imgEl && (
          <div className="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center">
            <Loader2 size={24} className="spin text-ink-600" />
          </div>
        )}

        
        {processing && (
          <div className="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
            style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)', zIndex: 10 }}>
            <div className="d-flex align-items-center gap-2 bg-ink-800 border border-ink-700 px-4 py-3 rounded-3 shadow small fw-medium text-ink-100">
              <Loader2 size={16} className="spin text-accent" />
              Processing image…
            </div>
          </div>
        )}

        
        {notification && (
          <div className={`toast-note d-flex align-items-center gap-2 ${
            notification.type === 'success' ? 'bg-accent text-ink-900' : 'bg-danger text-white'
          }`}>
            <CheckCircle size={13} />
            {notification.msg}
          </div>
        )}
      </div>

      
      {historyLabels.length > 0 && (
        <div className="d-flex align-items-center gap-1 px-3 py-2 border-top border-ink-800 bg-ink-900 overflow-auto flex-shrink-0">
          <span className="small text-ink-500 flex-shrink-0 me-1">History</span>
          <div className="rounded-circle bg-ink-800 d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: 20, height: 20 }}>
            <RotateCcw size={9} className="text-ink-500" />
          </div>
          {historyLabels.map((h, i) => (
            <div key={i} className="d-flex align-items-center gap-1 flex-shrink-0">
              <div style={{ width: 12, height: 1, background: h.active ? 'rgba(232,255,71,.6)' : 'var(--ink-700)' }} />
              <span className={`chip ${h.current ? 'current' : h.active ? 'active' : ''}`}>
                {h.label}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
