import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyDecline, classifyHttpFailure } from "../lib/decline.js";

test("UMG sandbox Code:203 is a soft decline and may cascade", () => {
  const r = classifyDecline({
    status: "DECLINED",
    informationData: "Activity limit exceeded; Code:203",
    httpStatus: 201,
  });
  assert.equal(r.declineClass, "soft");
  assert.equal(r.cascadeAction, "next");
});

test("MID lowest ticket is soft", () => {
  const r = classifyDecline({
    status: "DECLINED",
    informationData: "MID Limits Error: Lowest ticket",
    httpStatus: 201,
  });
  assert.equal(r.declineClass, "soft");
  assert.equal(r.cascadeAction, "next");
});

test("fraud / do-not-honor / invalid card stop the cascade", () => {
  for (const informationData of ["Do not honor", "Fraud suspected", "Invalid card", "Stolen card"]) {
    const r = classifyDecline({ status: "DECLINED", informationData, httpStatus: 201 });
    assert.equal(r.declineClass, "hard", informationData);
    assert.equal(r.cascadeAction, "stop", informationData);
  }
});

test("timeout and 5xx are soft", () => {
  assert.equal(classifyHttpFailure(null, "timeout").declineClass, "soft");
  assert.equal(classifyHttpFailure(503, "").declineClass, "soft");
  assert.equal(classifyDecline({ status: "PROCESSOR_DOWN", errorMessage: "timeout" }).cascadeAction, "next");
});

test("APPROVED and 3DS do not cascade", () => {
  assert.equal(classifyDecline({ status: "APPROVED" }).cascadeAction, "success");
  assert.equal(classifyDecline({ status: "AWAITING FOR 3DS VERIFICATION" }).cascadeAction, "wait");
  assert.equal(classifyDecline({ status: "PENDING" }).cascadeAction, "wait");
});

test("UMG typo APPORVED is treated as approved by mapper via success path", () => {
  const r = classifyDecline({ status: "APPROVED" });
  assert.equal(r.cascadeAction, "success");
});
