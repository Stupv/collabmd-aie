#!/usr/bin/env node

import { loadConfig } from "./config/env.js";
import { createAppServer } from "./create-app-server.js";
import { prepareConfigForStartup } from "./startup/git-remote-bootstrap.js";

export function printAuthWarnings(authStrategy, tunnelUrl) {
  if (authStrategy !== "none") return;
  if (tunnelUrl) {
    process.stderr.write(
      [
        "",
        "WARNING: SECURITY",
        "----------------------------------------------",
        "Authentication is disabled (--auth none) and a",
        "Cloudflare tunnel is active:",
        `  ${tunnelUrl}`,
        "Anyone with this URL has FULL WRITE access to",
        "your vault. To add password protection, restart",
        "with: --auth password",
        "----------------------------------------------",
        "",
      ].join("\n"),
    );
  } else {
    process.stderr.write(
      "WARNING: Auth is disabled. Anyone on the local network has full write access to this vault.\n",
    );
  }
}

let shutdownPromise = null;
const config = loadConfig();
let bootstrapResult;

try {
  bootstrapResult = await prepareConfigForStartup(config);
} catch (error) {
  console.error("[server] Failed to prepare git-backed vault:", error.message);
  process.exit(1);
}

if (bootstrapResult?.skippedRemoteSync) {
  process.stderr.write(
    [
      "",
      "WARNING: Remote sync skipped — vault may be behind the remote",
      `Reason: ${bootstrapResult.reason}`,
      "Dirty files:",
      ...(bootstrapResult.dirtyFiles || []).map((f) => `  - ${f}`),
      "Commit or stash local changes and restart to sync from remote.",
      "",
    ].join("\n"),
  );
}

const server = createAppServer(config);

function shutdown(signal) {
  if (shutdownPromise) {
    return shutdownPromise;
  }

  console.log(`[server] Received ${signal}, shutting down`);

  const forceExitTimer = setTimeout(() => {
    console.error("[server] Forced shutdown after timeout");
    process.exit(1);
  }, 5000);
  forceExitTimer.unref?.();

  shutdownPromise = server
    .close()
    .then(() => {
      clearTimeout(forceExitTimer);
      process.exit(0);
    })
    .catch((error) => {
      clearTimeout(forceExitTimer);
      console.error("[server] Shutdown error:", error.message);
      process.exit(1);
    });

  return shutdownPromise;
}

process.once("SIGINT", () => {
  void shutdown("SIGINT");
});
process.once("SIGTERM", () => {
  void shutdown("SIGTERM");
});

server
  .listen()
  .then(({ host, port, wsPath }) => {
    console.log("");
    console.log("  CollabMD Vault Server");
    console.log(`  http://${host}:${port}`);
    console.log(`  ws route: ${wsPath}`);
    console.log(`  vault: ${server.config.vaultDir}`);
    console.log(`  files: ${server.vaultFileCount} vault files`);
    if (server.config.auth.strategy === "password") {
      console.log(`  auth: password (${server.config.auth.password})`);
    } else if (server.config.auth.strategy === "oidc") {
      console.log(`  auth: oidc (${server.config.auth.oidc.provider})`);
      console.log(`  public: ${server.config.auth.oidc.publicBaseUrl}`);
      console.log(`  callback: ${server.config.auth.oidc.callbackUrl}`);
    } else {
      console.log("  auth: none");
    }
    console.log("");
    printAuthWarnings(server.config.auth.strategy);
  })
  .catch(async (error) => {
    await config.git?.cleanup?.();
    console.error("[server] Failed to start:", error.message);
    process.exit(1);
  });
