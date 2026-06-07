import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDb } from './db.js';
import uploadRouter from './routes/upload.js';
import imagesRouter from './routes/images.js';
import editsRouter from './routes/edits.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Serve uploaded originals and processed files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use('/processed', express.static(path.join(__dirname, '../processed')));

// Routes
app.use('/api/upload', uploadRouter);
app.use('/api/images', imagesRouter);
app.use('/api/edits', editsRouter);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

initDb();

app.listen(PORT, () => {
  console.log(`Image Editor API running on port ${PORT}`);
});
