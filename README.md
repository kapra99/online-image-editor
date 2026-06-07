# Pixl — Image Editor

A full-stack image editing web application built with React, Node.js, and Sharp.

## Features

- **Upload** one or more images (JPG, PNG, WebP — up to 20MB each)
- **Image Library** — browse all uploaded images, switch between them instantly
- **Crop** — interactive drag-and-resize crop selection on canvas
- **Rotate / Flip** — rotate 90° and flip horizontally/vertically
- **Blur** — Gaussian blur with adjustable sigma via slider
- **Sharpen** — unsharp-mask sharpening with adjustable intensity
- **Undo / Redo** — full non-destructive edit history per image, persisted in the
  database and **restored when you reselect an image or refresh the page**
- **Export** — download the final edited image (original format preserved)
- **Persistent storage** — uploads, metadata, and full edit history survive container restarts
- **Responsive** — works on desktop and mobile (sidebar collapses into a slide-in drawer; toolbars wrap; canvas re-fits on rotation/resize)

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Konva.js (canvas), Bootstrap 5 |
| Backend | Node.js, Express, Sharp (image processing), Multer |
| Database | SQLite via better-sqlite3 |
| Infrastructure | Docker, Docker Compose, Nginx |

## Getting Started

### Prerequisites

- [Docker](https://www.docker.com/get-started) and Docker Compose installed

### Run

```bash
git clone <repo-url>
cd online-image-editor
docker compose up --build
```

Open **http://localhost:3000** in your browser.

The first build takes ~2 minutes (installing native dependencies for Sharp). Subsequent starts are fast.

### Stop

```bash
docker compose down
```

Data (uploads, processed images, database) is stored in Docker named volumes and persists between restarts. To wipe everything:

```bash
docker compose down -v
```

## Architecture

```
browser ──► nginx (port 3000)
               │
               ├─ /api/*      ──► Express backend (port 3001)
               ├─ /uploads/*  ──►      │
               └─ /processed/*──►      │
                                       │
                                  Sharp (processing)
                                  SQLite (metadata + history)
```

### How editing works

All edits are **non-destructive**. The original file is never modified. When an edit is applied:

1. The operation + parameters are saved to the `edit_history` table in SQLite.
2. Sharp re-applies the full chain of operations on the original file.
3. The result is stored as a new file in `/processed`.

Undo/Redo works by re-rendering the image at any point in the edit history chain.

## API Endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/api/upload` | Upload images (multipart/form-data) |
| GET | `/api/images` | List all images |
| GET | `/api/images/:id` | Get image + edit history |
| DELETE | `/api/images/:id` | Delete image |
| POST | `/api/edits/:imageId` | Apply an edit operation |
| POST | `/api/edits/:imageId/revert` | Revert to a step (undo/redo) |

## Development (without Docker)

```bash
# Backend
cd backend
npm install
node src/index.js

# Frontend (new terminal)
cd frontend
npm install
npm run dev
```

Backend runs on `:3001`, frontend dev server on `:3000` with proxy to backend.
