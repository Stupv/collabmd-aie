function trimTrailingSlash(value) {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

export function getRuntimeConfig() {
  return {
    auth: {
      enabled: false,
      implemented: true,
      requiresLogin: false,
      sessionEndpoint: '/api/auth/session',
      statusEndpoint: '/api/auth/status',
      strategy: 'none',
    },
    environment: 'development',
    gitEnabled: true,
    publicWsBaseUrl: '',
    wsBasePath: '/ws',
    ...(window.__COLLABMD_CONFIG__ ?? {}),
  };
}

function getHashParams() {
  const rawHash = window.location.hash.startsWith('#')
    ? window.location.hash.slice(1)
    : window.location.hash;
  return new URLSearchParams(rawHash);
}

function normalizeDiffScope(scope) {
  if (scope === 'staged' || scope === 'all' || scope === 'working-tree') {
    return scope;
  }

  return 'all';
}

export function getHashRoute() {
  const params = getHashParams();

  if (params.has('git-diff')) {
    const filePath = params.get('git-diff') || null;
    return {
      filePath,
      scope: normalizeDiffScope(params.get('scope') || (filePath ? 'working-tree' : 'all')),
      type: 'git-diff',
    };
  }

  if (params.has('file')) {
    return {
      filePath: params.get('file'),
      type: 'file',
    };
  }

  return { type: 'empty' };
}

export function navigateToFile(filePath) {
  const params = new URLSearchParams();
  if (filePath) {
    params.set('file', filePath);
  }
  window.location.hash = params.toString();
}

export function navigateToGitDiff({ filePath = null, scope = 'all' } = {}) {
  const params = new URLSearchParams();
  params.set('git-diff', filePath ?? '');
  params.set('scope', normalizeDiffScope(scope));
  window.location.hash = params.toString();
}

export function resolveWsBaseUrl() {
  const params = new URLSearchParams(window.location.search);
  const customServerUrl = params.get('server');

  if (customServerUrl) {
    return trimTrailingSlash(customServerUrl);
  }

  const config = getRuntimeConfig();
  if (config.publicWsBaseUrl) {
    return trimTrailingSlash(config.publicWsBaseUrl);
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}${config.wsBasePath}`;
}
