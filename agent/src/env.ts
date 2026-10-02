import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const cliRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function applyEnvFile(path: string) {
  if (!existsSync(path)) return;

  const text = readFileSync(path, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;

    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

export function loadEnv() {
  applyEnvFile(join(cliRoot, ".env"));
  applyEnvFile(join(cliRoot, "..", "..", ".env"));
}

export function apiBaseUrl() {
  return (process.env.API_BASE_URL ?? "http://localhost:3001").replace(
    /\/$/,
    "",
  );
}

export function claudeModelId() {
  return (process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5.5").replace(
    /^anthropic\//,
    "",
  );
}
