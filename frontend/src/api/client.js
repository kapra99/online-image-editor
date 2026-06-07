const BASE = '/api';

export async function fetchImages() {
  const res = await fetch(`${BASE}/images`);
  if (!res.ok) throw new Error('Failed to fetch images');
  return res.json();
}

export async function fetchImage(id) {
  const res = await fetch(`${BASE}/images/${id}`);
  if (!res.ok) throw new Error('Failed to fetch image');
  return res.json();
}

export async function uploadImages(files) {
  const form = new FormData();
  for (const f of files) form.append('images', f);
  const res = await fetch(`${BASE}/upload`, { method: 'POST', body: form });
  if (!res.ok) throw new Error('Upload failed');
  return res.json();
}

export async function applyEdit(imageId, operation, params, stepIndex) {
  const res = await fetch(`${BASE}/edits/${imageId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ operation, params, stepIndex }),
  });
  if (!res.ok) throw new Error('Edit failed');
  return res.json();
}

export async function revertToStep(imageId, stepIndex) {
  const res = await fetch(`${BASE}/edits/${imageId}/revert`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stepIndex }),
  });
  if (!res.ok) throw new Error('Revert failed');
  return res.json();
}

export async function deleteImage(id) {
  const res = await fetch(`${BASE}/images/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Delete failed');
  return res.json();
}

export function getImageUrl(image) {
  return `/uploads/${image.filename}`;
}

export function getProcessedUrl(filename) {
  return `/processed/${filename}`;
}
