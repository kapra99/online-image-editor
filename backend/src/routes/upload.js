import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = express.Router();

const storage = multer.diskStorage({
  destination: path.join(__dirname, '../../uploads'),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only images are allowed'));
  },
});

router.post('/', upload.array('images', 20), async (req, res) => {
  try {
    const db = getDb();
    const results = [];

    for (const file of req.files) {
      const id = uuidv4();
      const meta = await sharp(file.path).metadata();

      db.prepare(`
        INSERT INTO images (id, original_name, filename, mimetype, size, width, height)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(id, file.originalname, file.filename, file.mimetype, file.size, meta.width, meta.height);

      results.push({ id, originalName: file.originalname, filename: file.filename, width: meta.width, height: meta.height });
    }

    res.json({ success: true, images: results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
