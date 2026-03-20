import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";

import {
  resolveCliVaultDir,
  resolveConfiguredVaultDir,
} from "../../src/server/config/env.js";

test("resolveCliVaultDir prefers the positional directory over COLLABMD_VAULT_DIR", () => {
  const positionals = ["./docs/vault"];
  const env = { COLLABMD_VAULT_DIR: "/tmp/collabmd-env-vault" };

  assert.equal(resolveCliVaultDir(positionals, env), resolve("./docs/vault"));
});

test("resolveCliVaultDir falls back to COLLABMD_VAULT_DIR when no directory argument is provided", () => {
  const env = { COLLABMD_VAULT_DIR: "/tmp/collabmd-env-vault" };

  assert.equal(resolveCliVaultDir([], env), resolve("/tmp/collabmd-env-vault"));
});

test("resolveConfiguredVaultDir honors COLLABMD_VAULT_DIR when no explicit override is provided", () => {
  const env = { COLLABMD_VAULT_DIR: "/tmp/collabmd-config-vault" };

  assert.equal(
    resolveConfiguredVaultDir({}, env),
    "/tmp/collabmd-config-vault",
  );
});
