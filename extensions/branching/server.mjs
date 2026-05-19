function requireSessionId(input) {
  if (!input || typeof input !== 'object' || typeof input.sessionId !== 'string' || !input.sessionId) {
    throw new Error('sessionId is required');
  }
  return input.sessionId;
}

function ensureBranchingApi(ctx) {
  if (!ctx.sessions.getForkMessages || !ctx.sessions.forkSession || !ctx.sessions.cloneSession) {
    throw new Error('Session adapter does not support branching');
  }
}

function resolveForkSelection(messages, target) {
  const trimmed = target.trim();
  if (!trimmed) return null;
  const numeric = Number(trimmed);
  if (Number.isInteger(numeric) && numeric >= 1 && numeric <= messages.length) return messages[numeric - 1];
  return messages.find((message) => message.entryId === trimmed)
    ?? messages.find((message) => message.text.toLowerCase().includes(trimmed.toLowerCase()))
    ?? null;
}

export default function activate(ctx) {
  ctx.commands.register({
    id: 'core.branching.fork',
    title: 'Fork session',
    description: 'Create a new session from a previous user message.',
    slashName: 'fork',
    run: async (input = {}) => {
      ensureBranchingApi(ctx);
      const sessionId = requireSessionId(input);
      const argv = typeof input.argv === 'string' ? input.argv.trim() : '';
      if (!argv) return { prcAction: 'openForkDialog' };
      const messages = await ctx.sessions.getForkMessages(sessionId);
      const selected = resolveForkSelection(messages, argv);
      if (!selected) throw new Error(`No fork message matches "${argv}".`);
      const result = await ctx.sessions.forkSession(sessionId, selected.entryId);
      if (result.cancelled) return { prcAction: 'notice', notice: 'Fork cancelled by extension.' };
      return {
        prcAction: 'openSession',
        session: result.session,
        ...(result.text ? { draftText: result.text } : {}),
        notice: result.text ? 'Forked session. The selected prompt is ready to edit.' : 'Forked session.',
      };
    },
  });

  ctx.commands.register({
    id: 'core.branching.clone',
    title: 'Clone session',
    description: 'Clone the current session into a new session.',
    slashName: 'clone',
    run: async (input = {}) => {
      ensureBranchingApi(ctx);
      const sessionId = requireSessionId(input);
      const result = await ctx.sessions.cloneSession(sessionId);
      if (result.cancelled) return { prcAction: 'notice', notice: 'Clone cancelled by extension.' };
      return { prcAction: 'openSession', session: result.session, notice: 'Cloned session.' };
    },
  });

  ctx.server.api.get('/api/sessions/:sessionId/fork-messages', async (request) => {
    ensureBranchingApi(ctx);
    return ctx.sessions.getForkMessages(request.params.sessionId);
  });

  ctx.server.api.post('/api/sessions/:sessionId/fork', async (request) => {
    ensureBranchingApi(ctx);
    const body = await request.json();
    if (!body || typeof body !== 'object' || typeof body.entryId !== 'string' || !body.entryId) {
      return { status: 400, body: { error: 'entryId is required' } };
    }
    return ctx.sessions.forkSession(request.params.sessionId, body.entryId);
  });

  ctx.server.api.post('/api/sessions/:sessionId/clone', async (request) => {
    ensureBranchingApi(ctx);
    return ctx.sessions.cloneSession(request.params.sessionId);
  });
}
