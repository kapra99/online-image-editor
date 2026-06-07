import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR  = path.join(__dirname, '../../uploads');
const PROCESSED_DIR = path.join(__dirname, '../../processed');

const router = express.Router();

/**
 * Apply a chain of operations to the original image file.
 * Each op.params comes from the DB as a JSON string — we parse it here.
 */
async function applyOps(sourceFile, ops) {
  // Always start from the original, auto-rotating from EXIF
  let pipeline = sharp(sourceFile).rotate();

  for (const op of ops) {
    // params is stored as JSON string in SQLite; parse if needed
    const p = typeof op.params === 'string' ? JSON.parse(op.params) : op.params;

    switch (op.operation) {
      case 'crop':
        pipeline = pipeline.extract({
          left:   Math.round(p.x),
          top:    Math.round(p.y),
          width:  Math.round(p.width),
          height: Math.round(p.height),
        });
        break;

      case 'blur':
        // Sharp blur sigma must be >= 0.3
        pipeline = pipeline.blur(Math.max(0.3, Number(p.sigma) || 1));
        break;

      case 'sharpen':
        pipeline = pipeline.sharpen({
          sigma: Math.max(0.000001, Number(p.sigma) || 1),
        });
        break;

      case 'rotate':
        pipeline = pipeline.rotate(Number(p.angle) || 90, {
          background: { r: 255, g: 255, b: 255, alpha: 1 },
        });
        break;

      case 'flip':
        if (p.direction === 'horizontal') pipeline = pipeline.flop();
        else pipeline = pipeline.flip();
        break;

      case 'resize':
        pipeline = pipeline.resize(Number(p.width), Number(p.height), { fit: 'inside' });
        break;

      default:
        console.warn('Unknown operation:', op.operation);
    }
  }

  // Preserve the original format (keep PNG/WebP transparency; correct extension
  // on download). Sharp infers the output format from the file extension.
  const ext = (path.extname(sourceFile) || '.png').toLowerCase();
  const outFilename = `${uuidv4()}${ext}`;
  const outPath = path.join(PROCESSED_DIR, outFilename);
  await pipeline.toFile(outPath);
  return outFilename;
}

/**
 * POST /api/edits/:imageId
 * Apply a new edit step. Clears any redo branch ahead of stepIndex.
 */
router.post('/:imageId', async (req, res) => {
  try {
    const db = getDb();
    const { operation, params, stepIndex } = req.body;

    if (operation === undefined || params === undefined || stepIndex === undefined) {
      return res.status(400).json({ error: 'operation, params, and stepIndex are required' });
    }

    const image = db.prepare('SELECT * FROM images WHERE id = ?').get(req.params.imageId);
    if (!image) return res.status(404).json({ error: 'Image not found' });

    // Clear redo branch — and delete the cached processed files for those
    // discarded steps so they don't pile up on disk.
    const stale = db.prepare(
      'SELECT result_filename FROM edit_history WHERE image_id = ? AND step_index >= ?'
    ).all(req.params.imageId, stepIndex);
    for (const s of stale) {
      if (s.result_filename) {
        fs.rmSync(path.join(PROCESSED_DIR, s.result_filename), { force: true });
      }
    }
    db.prepare('DELETE FROM edit_history WHERE image_id = ? AND step_index >= ?')
      .run(req.params.imageId, stepIndex);

    // Insert new step (params stored as JSON string)
    db.prepare(`
      INSERT INTO edit_history (image_id, step_index, operation, params)
      VALUES (?, ?, ?, ?)
    `).run(req.params.imageId, stepIndex, operation, JSON.stringify(params));

    // Re-apply full chain from original
    const steps = db.prepare(
      'SELECT * FROM edit_history WHERE image_id = ? ORDER BY step_index ASC'
    ).all(req.params.imageId);

    const sourceFile = path.join(UPLOADS_DIR, image.filename);
    const resultFilename = await applyOps(sourceFile, steps);

    // Cache result filename on this step
    db.prepare('UPDATE edit_history SET result_filename = ? WHERE image_id = ? AND step_index = ?')
      .run(resultFilename, req.params.imageId, stepIndex);

    res.json({ success: true, resultFilename, stepIndex });
  } catch (err) {
    console.error('[edits POST]', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/edits/:imageId/revert
 * Re-renders the image at a given step for undo/redo.
 * stepIndex = -1 means show original (no processing).
 */
router.post('/:imageId/revert', async (req, res) => {
  try {
    const db = getDb();
    const { stepIndex } = req.body;

    const image = db.prepare('SELECT * FROM images WHERE id = ?').get(req.params.imageId);
    if (!image) return res.status(404).json({ error: 'Image not found' });

    // -1 means original image — frontend handles showing /uploads/filename directly
    if (stepIndex < 0) {
      return res.json({ success: true, resultFilename: null });
    }

    // Each applied step already cached its rendered result. Undo/redo just needs
    // that cached file — no need to re-run Sharp (which would create a new file
    // on every undo and leak disk space).
    const step = db.prepare(
      'SELECT result_filename FROM edit_history WHERE image_id = ? AND step_index = ?'
    ).get(req.params.imageId, stepIndex);

    if (step && step.result_filename) {
      return res.json({ success: true, resultFilename: step.result_filename });
    }

    // Fallback (cache missing for some reason): rebuild the chain and re-cache.
    const steps = db.prepare(
      'SELECT * FROM edit_history WHERE image_id = ? AND step_index <= ? ORDER BY step_index ASC'
    ).all(req.params.imageId, stepIndex);

    if (!steps.length) {
      return res.json({ success: true, resultFilename: null });
    }

    const sourceFile = path.join(UPLOADS_DIR, image.filename);
    const resultFilename = await applyOps(sourceFile, steps);
    db.prepare('UPDATE edit_history SET result_filename = ? WHERE image_id = ? AND step_index = ?')
      .run(resultFilename, req.params.imageId, stepIndex);

    res.json({ success: true, resultFilename });
  } catch (err) {
    console.error('[edits revert]', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
