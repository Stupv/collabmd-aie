import { getRequestErrorStatusCode } from './http-errors.js';
import { jsonResponse } from './http-response.js';

function resolveDiffScope(requestUrl) {
  const scope = String(requestUrl.searchParams.get('scope') || '').trim().toLowerCase();
  if (scope === 'staged' || scope === 'all' || scope === 'working-tree') {
    return scope;
  }

  const staged = requestUrl.searchParams.get('staged');
  if (staged === 'true') {
    return 'staged';
  }

  return 'working-tree';
}

function isTruthyParam(value) {
  return value === '1' || value === 'true';
}

export function createGitApiHandler({ gitService = null }) {
  return async function handleGitApi(req, res, requestUrl) {
    if (!requestUrl.pathname.startsWith('/api/git')) {
      return false;
    }

    if (!gitService) {
      jsonResponse(req, res, 503, { error: 'Git integration is not configured' });
      return true;
    }

    if (requestUrl.pathname === '/api/git/status' && req.method === 'GET') {
      try {
        const status = await gitService.getStatus();
        jsonResponse(req, res, 200, status);
      } catch (error) {
        const statusCode = getRequestErrorStatusCode(error);
        if (statusCode) {
          jsonResponse(req, res, statusCode, { error: error.message });
          return true;
        }

        console.error('[api] Failed to read git status:', error.message);
        jsonResponse(req, res, 500, { error: 'Failed to read git status' });
      }
      return true;
    }

    if (requestUrl.pathname === '/api/git/diff' && req.method === 'GET') {
      try {
        const diff = await gitService.getDiff({
          allowLargePatch: isTruthyParam(requestUrl.searchParams.get('allowLargePatch')),
          metaOnly: isTruthyParam(requestUrl.searchParams.get('metaOnly')),
          path: requestUrl.searchParams.get('path'),
          scope: resolveDiffScope(requestUrl),
        });
        jsonResponse(req, res, 200, diff);
      } catch (error) {
        const statusCode = getRequestErrorStatusCode(error);
        if (statusCode) {
          jsonResponse(req, res, statusCode, { error: error.message });
          return true;
        }

        console.error('[api] Failed to read git diff:', error.message);
        jsonResponse(req, res, 500, { error: 'Failed to read git diff' });
      }
      return true;
    }

    jsonResponse(req, res, 404, { error: 'Git API endpoint not found' });
    return true;
  };
}
