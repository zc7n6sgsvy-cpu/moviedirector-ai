/**
 * Render.com worker — stitches Grok clips into one MP4 via FFmpeg.
 * Set env: MONGODB_URI, RENDER_WORKER_SECRET, BLOB_READ_WRITE_TOKEN, MOVIEDIRECTOR_API_URL
 */
import http from 'http';
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { put } from '@vercel/blob';

const execFileAsync = promisify(execFile);
const PORT = process.env.PORT || 10000;
const SECRET = process.env.RENDER_WORKER_SECRET || '';

if (!SECRET) {
  console.error('RENDER_WORKER_SECRET must be set — refusing to start');
  process.exit(1);
}

async function downloadFile(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed ${url}: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(dest, buf);
}

async function stitchClips(clipUrls, outputPath, workDir) {
  const listPath = path.join(workDir, 'clips.txt');
  const lines = [];
  for (let i = 0; i < clipUrls.length; i++) {
    const clipPath = path.join(workDir, `clip_${String(i).padStart(3, '0')}.mp4`);
    await downloadFile(clipUrls[i], clipPath);
    lines.push(`file '${clipPath.replace(/'/g, "'\\''")}'`);
  }
  await fs.writeFile(listPath, lines.join('\n'));
  await execFileAsync('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', listPath, '-c', 'copy', outputPath]);
}

async function updateJob(jobId, payload) {
  const api = process.env.MOVIEDIRECTOR_API_URL;
  if (!api) return;
  await fetch(`${api.replace(/\/$/, '')}/api/render/${jobId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SECRET}`,
    },
    body: JSON.stringify(payload),
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (req.method !== 'POST' || req.url !== '/render') {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  const auth = req.headers.authorization || '';
  if (auth !== `Bearer ${SECRET}`) {
    res.writeHead(401);
    res.end('Unauthorized');
    return;
  }

  let body = '';
  req.on('data', (chunk) => { body += chunk; });
  req.on('end', async () => {
    try {
      const { jobId, clipUrls, projectTitle } = JSON.parse(body);
      if (!jobId || !clipUrls?.length) throw new Error('jobId and clipUrls required');

      await updateJob(jobId, { status: 'processing', progress: 10 });

      const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'md-render-'));
      const outputPath = path.join(workDir, 'final.mp4');

      await stitchClips(clipUrls, outputPath, workDir);
      await updateJob(jobId, { status: 'processing', progress: 80 });

      const file = await fs.readFile(outputPath);
      const blob = await put(`renders/${jobId}.mp4`, file, {
        access: 'public',
        contentType: 'video/mp4',
        addRandomSuffix: true,
      });

      await updateJob(jobId, { status: 'done', progress: 100, outputUrl: blob.url });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, outputUrl: blob.url, projectTitle }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Render failed';
      try {
        const parsed = JSON.parse(body || '{}');
        if (parsed.jobId) await updateJob(parsed.jobId, { status: 'failed', error: message, progress: 0 });
      } catch {}
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: message }));
    }
  });
});

server.listen(PORT, () => {
  console.log(`MovieDirector render worker listening on ${PORT}`);
});