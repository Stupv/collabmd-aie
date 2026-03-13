const NON_RECONNECT_CLOSE_REASONS = new Set([
  'Room reset',
  'Server shutting down',
]);

export function stopReconnectOnControlledClose(provider) {
  if (!provider || typeof provider.on !== 'function' || typeof provider.disconnect !== 'function') {
    return;
  }

  provider.on('connection-close', (event) => {
    const reason = String(event?.reason || '');
    if (!NON_RECONNECT_CLOSE_REASONS.has(reason)) {
      return;
    }

    provider.disconnect();
  });
}
