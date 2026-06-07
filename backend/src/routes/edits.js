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


async function applyOps(sourceFile, ops) {
  let pipeline = sharp(sourceFile).rotate();

  for (const op of ops) {
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

  const ext = (path.extname(sourceFile) || '.png').toLowerCase();
  const outFilename = `${uuidv4()}${ext}`;
  const outPath = path.join(PROCESSED_DIR, outFilename);
  await pipeline.toFile(outPath);
  return outFilename;
}

router.post('/:imageId', async (req, res) => {
  try {
    const db = getDb();
    const { operation, params, stepIndex } = req.body;

    if (operation === undefined || params === undefined || stepIndex === undefined) {
      return res.status(400).json({ error: 'operation, params, and stepIndex are required' });
    }

    const image = db.prepare('SELECT * FROM images WHERE id = ?').get(req.params.imageId);
    if (!image) return res.status(404).json({ error: 'Image not found' });

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

  
    db.prepare(`
      INSERT INTO edit_history (image_id, step_index, operation, params)
      VALUES (?, ?, ?, ?)
    `).run(req.params.imageId, stepIndex, operation, JSON.stringify(params));

    const steps = db.prepare(
      'SELECT * FROM edit_history WHERE image_id = ? ORDER BY step_index ASC'
    ).all(req.params.imageId);

    const sourceFile = path.join(UPLOADS_DIR, image.filename);
    const resultFilename = await applyOps(sourceFile, steps);

    db.prepare('UPDATE edit_history SET result_filename = ? WHERE image_id = ? AND step_index = ?')
      .run(resultFilename, req.params.imageId, stepIndex);

    res.json({ success: true, resultFilename, stepIndex });
  } catch (err) {
    console.error('[edits POST]', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/:imageId/revert', async (req, res) => {
  try {
    const db = getDb();
    const { stepIndex } = req.body;

    const image = db.prepare('SELECT * FROM images WHERE id = ?').get(req.params.imageId);
    if (!image) return res.status(404).json({ error: 'Image not found' });

  
    if (stepIndex < 0) {
      return res.json({ success: true, resultFilename: null });
    }

    const step = db.prepare(
      'SELECT result_filename FROM edit_history WHERE image_id = ? AND step_index = ?'
    ).get(req.params.imageId, stepIndex);

    if (step && step.result_filename) {
      return res.json({ success: true, resultFilename: step.result_filename });
    }

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
