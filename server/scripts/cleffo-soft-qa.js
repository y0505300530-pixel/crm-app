import { fileURLToPath } from "node:url";
import {
  PHONE_PROBES,
  REJECTED_PHONES,
  SANDBOX_PRODUCT,
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

export function validationLines(errors) {
  const lines = [];
  function walk(value, path) {
    if (typeof value === "string") lines.push(`${path}: ${value}`);
    else if (Array.isArray(value)) value.forEach((item, i) => walk(item, `${path}.${i}`));
    else if (value && typeof value === "object") {
      for (const [key, item] of Object.entries(value)) walk(item, path ? `${path}.${key}` : key);
    }
  }
  if (errors) walk(errors, "");
  return lines;
}

export function isPhoneRejected(result) {
  return validationLines(result?.errors).some((line) => /phone/i.test(line) && /valid number/i.test(line));
}

export function formatSoftQaOutput(view) {
  const lines = [];
  for (const key of PRINT_KEYS) {
    if (view?.[key]) lines.push(`${key}: ${view[key]}`);
  }
  lines.push("sandbox_host: apis-dev.cleffo.com");
  lines.push("checkout: false");
  lines.push(`product_id: ${view?.product_id || SANDBOX_PRODUCT.product_id}`);
  if (view?.phone_probe) lines.push(`phone_probe: ${view.phone_probe}`);
  if (view?.phone_value) lines.push(`phone_value: ${view.phone_value}`);
  if (view?.phone_accepted === true) lines.push("phone_accepted: true");
  if (view?.phone_accepted === false) lines.push("phone_accepted: false");
  if (view?.phone_probes_tried) lines.push(`phone_probes_tried: ${view.phone_probes_tried}`);
  for (const line of view?.validation || []) lines.push(`validation: ${line}`);
  if (!view?.ok && view?.error) lines.push(`error: ${view.error}`);
  if (view?.success === true) lines.push("success: true");
  if (view?.success === false) lines.push("success: false");
  lines.push("note: redirect is not success. Poll status until pending, completed, or failed.");
  lines.push("rejected_phones: +12025550100, 12025550100 (Phone number must be valid number.)");
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

function probeList(argv) {
  const forced = argValue(argv, "--phone");
  if (forced) {
    return [{ id: "cli", value: forced, preserve: /[^0-9]/.test(forced), asNumber: argv.includes("--phone-json") }];
  }
  const probes = [...PHONE_PROBES];
  if (argv.includes("--include-rejected-phones")) {
    probes.push(...REJECTED_PHONES.map((item) => ({ ...item, preserve: item.value.startsWith("+") })));
  }
  return probes;
}

function withPhoneMeta(view, probe, result, tried) {
  return {
    ...view,
    product_id: SANDBOX_PRODUCT.product_id,
    phone_probe: probe.id,
    phone_value: String(probe.value),
    phone_accepted: !isPhoneRejected(result),
    phone_probes_tried: tried.join(","),
    validation: validationLines(result?.errors),
  };
}

export async function runSoftQa(argv, deps = {}) {
  const config = resolveCleffoConfig(deps);
  const env = deps.env || process.env;
  if (argv.includes("--status")) {
    const ref = argValue(argv, "--status");
    const status = await getPaymentStatus(ref, deps);
    return { config, view: publicCleffoView(status) };
  }
  const baseOrder = argValue(argv, "--order") || `CLEFFO-QA-${Date.now()}`;
  const redirectUrl = argValue(argv, "--redirect") || undefined;
  const probes = probeList(argv);
  const tried = [];
  let created = null;
  let probe = probes[0];
  let view = publicCleffoView({ ok: false, error: "cleffo_sandbox_not_configured" });
  for (const candidate of probes) {
    probe = candidate;
    tried.push(candidate.id);
    created = await createPaymentLink(sandboxTenDollarInput({
      merchantOrderId: `${baseOrder}-${candidate.id}`.slice(0, 64),
      redirectUrl,
      phone: candidate.value,
      phonePreserve: candidate.preserve === true,
      phoneAsNumber: candidate.asNumber === true,
    }, env), deps);
    view = withPhoneMeta(publicCleffoView(created), candidate, created, tried);
    if (created.error === "cleffo_sandbox_not_configured" || created.error === "cleffo_sandbox_host_required") break;
    if (!isPhoneRejected(created)) break;
  }
  if (!created?.ok || !argv.includes("--poll")) return { config, view };
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
      payment_link: view.payment_link,
      transaction_reference_number: view.transaction_reference_number || polled.transaction_reference_number,
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
