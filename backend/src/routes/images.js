import express from 'express';
import { getDb } from '../db.js';

const router = express.Router();

// List all images
router.get('/', (_req, res) => {
  try {
    const images = getDb().prepare('SELECT * FROM images ORDER BY created_at DESC').all();
    res.json(images);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single image with its edit history
router.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const image = db.prepare('SELECT * FROM images WHERE id = ?').get(req.params.id);
    if (!image) return res.status(404).json({ error: 'Image not found' });

    const history = db.prepare(
      'SELECT * FROM edit_history WHERE image_id = ? ORDER BY step_index ASC'
    ).all(req.params.id);

    res.json({ ...image, history });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete image and its history
router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM edit_history WHERE image_id = ?').run(req.params.id);
    db.prepare('DELETE FROM images WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
