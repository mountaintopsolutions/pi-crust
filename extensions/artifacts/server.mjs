import fs from 'node:fs/promises';
import path from 'node:path';

const ARTIFACT_MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

export default function activate(ctx) {
  ctx.server.api.get('/api/sessions/:sessionId/artifacts/:file', async (request) => {
    const sessionId = request.params.sessionId;
    const file = request.params.file;
    if (!isSafeFileSegment(file)) return { status: 400, body: { error: 'invalid artifact filename' } };

    let session;
    try {
      session = await ctx.sessions.get?.(registrySessionId(sessionId));
    } catch (error) {
      return { status: 404, body: { error: error instanceof Error ? error.message : 'unknown session' } };
    }
    if (!session || typeof session !== 'object' || typeof session.cwd !== 'string' || !session.cwd) {
      return { status: 500, body: { error: 'session has no cwd' } };
    }

    const artifactsDir = path.resolve(session.cwd, '.pi/artifacts', sessionId);
    const filePath = path.resolve(artifactsDir, file);
    if (filePath !== path.join(artifactsDir, file)) return { status: 400, body: { error: 'path escape rejected' } };

    let stat;
    try {
      stat = await fs.stat(filePath);
    } catch {
      return { status: 404, body: { error: 'artifact not found' } };
    }
    if (!stat.isFile()) return { status: 404, body: { error: 'not a file' } };

    const ext = path.extname(file).toLowerCase();
    const body = await fs.readFile(filePath);
    return {
      status: 200,
      headers: {
        'Content-Type': ARTIFACT_MIME[ext] ?? 'application/octet-stream',
        'Content-Length': String(body.byteLength),
        'Cache-Control': 'private, max-age=300',
      },
      body,
    };
  });
}

function registrySessionId(sessionId) {
  const underscoreIdx = sessionId.lastIndexOf('_');
  return underscoreIdx >= 0 ? sessionId.slice(underscoreIdx + 1) : sessionId;
}

function isSafeFileSegment(file) {
  return typeof file === 'string' && file !== '' && file !== '.' && file !== '..' && !file.includes('/') && !file.includes('\\') && !file.includes('\0');
}
