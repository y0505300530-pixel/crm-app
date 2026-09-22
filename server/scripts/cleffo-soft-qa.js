import { fileURLToPath } from "node:url";
import {
  createPaymentLink,
  getPaymentStatus,
  publicCleffoView,
  resolveCleffoConfig,
  sandboxTenDollarInput,
} from "../lib/processors/cleffo.js";

const PRINT_KEYS = [
  "payment_link",
  "transaction_reference_number",
  "merchant_order_id",
  "payment_source",
  "status",
];

export function formatSoftQaOutput(view) {
  const lines = [];
  for (const key of PRINT_KEYS) {
    if (view?.[key]) lines.push(`${key}: ${view[key]}`);
  }
  lines.push("sandbox_host: apis-dev.cleffo.com");
  lines.push("checkout: false");
  if (!view?.ok && view?.error) lines.push(`error: ${view.error}`);
  if (view?.success === true) lines.push("success: true");
  if (view?.success === false) lines.push("success: false");
  lines.push("note: redirect is not success. Poll status until pending, completed, or failed.");
  lines.push("todo: public docs do not separate 2D vs 3DS test cards — use Bryan's scenarios.");
  return `${lines.join("\n")}\n`;
}

export function outputLeaksSecrets(text, config) {
  for (const secret of [config.clientKey, config.signatureKey, config.apiKey]) {
    if (secret && String(secret).length >= 4 && text.includes(String(secret))) return true;
  }
  return false;
}

function argValue(argv, name) {
  const idx = argv.indexOf(name);
  if (idx === -1) return "";
  return argv[idx + 1] || "";
}

export async function runSoftQa(argv, deps = {}) {
  const config = resolveCleffoConfig(deps);
  const env = deps.env || process.env;
  if (argv.includes("--status")) {
    const ref = argValue(argv, "--status");
    const status = await getPaymentStatus(ref, deps);
    return { config, view: publicCleffoView(status) };
  }
  const created = await createPaymentLink(sandboxTenDollarInput({
    merchantOrderId: argValue(argv, "--order") || undefined,
    redirectUrl: argValue(argv, "--redirect") || undefined,
  }, env), deps);
  const view = publicCleffoView(created);
  if (!created.ok || !argv.includes("--poll")) return { config, view };
  const ref = created.transaction_reference_number;
  let last = view;
  const rounds = Number(deps.pollRounds || 6);
  const wait = deps.wait || ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  for (let i = 0; i < rounds; i += 1) {
    await wait(deps.pollIntervalMs ?? 5000);
    const status = await getPaymentStatus(ref, deps);
    const polled = publicCleffoView(status);
    last = {
      ...view,
      ok: polled.ok,
      status: polled.status,
      success: polled.success,
      error: polled.ok ? undefined : polled.error,
    };
    if (status.status === "completed" || status.status === "failed") break;
  }
  return { config, view: last };
}

async function main() {
  const { config, view } = await runSoftQa(process.argv.slice(2));
  const text = formatSoftQaOutput(view);
  if (outputLeaksSecrets(text, config)) {
    process.stderr.write("cleffo_soft_qa_failed: secret_leak\n");
    process.exitCode = 2;
    return;
  }
  process.stdout.write(text);
  const documented = view.status === "pending" || view.status === "completed" || view.status === "failed";
  if (!view.ok && !documented) {
    process.exitCode = view.error === "cleffo_sandbox_not_configured" || view.error === "cleffo_sandbox_host_required" ? 2 : 1;
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  main().catch(() => {
    process.stderr.write("cleffo_soft_qa_failed\n");
    process.exitCode = 1;
  });
}
