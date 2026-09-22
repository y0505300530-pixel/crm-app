import { existsSync, readFileSync } from "node:fs";

const DEFAULT_UMG_ENV_PATH = "/root/secure-quarantine-20260917-audit/umg.env";

function parseEnvFile(raw) {
  const out = {};
  for (const line of String(raw || "").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

export function umgEnvPath() {
  return process.env.UMG_ENV_PATH || DEFAULT_UMG_ENV_PATH;
}

export function loadUmgSecret() {
  if (process.env.UMG_API_SECRET) return process.env.UMG_API_SECRET;
  const path = umgEnvPath();
  if (!path || !existsSync(path)) return null;
  const parsed = parseEnvFile(readFileSync(path, "utf8"));
  return parsed.UMG_API_SECRET || parsed.API_KEY || null;
}

export function hasUmgSecret() {
  return Boolean(loadUmgSecret());
}

export function umgAuthorizationValue(secret) {
  return Buffer.from(String(secret), "utf8").toString("base64");
}

export function umgBasicHeader(secret) {
  return `Basic ${umgAuthorizationValue(secret)}`;
}

export function secretHealth() {
  const base = String(process.env.CLEFFO_BASE_URL || "https://apis-dev.cleffo.com").trim();
  let cleffoHostOk = false;
  try {
    const url = new URL(base);
    cleffoHostOk = url.protocol === "https:" && url.hostname === "apis-dev.cleffo.com" && !url.username;
  } catch {
    cleffoHostOk = false;
  }
  const cleffoKeys = Boolean(
    process.env.CLEFFO_CLIENT_KEY && process.env.CLEFFO_SIGNATURE_KEY && process.env.CLEFFO_API_KEY,
  );
  return {
    umgSecretConfigured: hasUmgSecret(),
    umgEnvPath: umgEnvPath(),
    source: process.env.UMG_API_SECRET ? "env" : hasUmgSecret() ? "file" : "none",
    cleffoSandboxConfigured: cleffoKeys && cleffoHostOk,
    cleffoSandboxHost: cleffoHostOk ? "apis-dev.cleffo.com" : "refused",
    cleffoCheckoutEnabled: false,
  };
}
