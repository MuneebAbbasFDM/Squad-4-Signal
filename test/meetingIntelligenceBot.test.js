"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { MeetingIntelligenceBot, normaliseText } = require("../src/meetingIntelligenceBot");

test("normaliseText expands supported abbreviations", () => {
  const result = normaliseText("EB aligned with DC and DP. NP is strong.");
  assert.match(result, /economic buyer/i);
  assert.match(result, /decision criteria/i);
  assert.match(result, /decision process/i);
  assert.match(result, /need-payoff/i);
});

test("analyzeMeeting returns captured framework coverage for relevant evidence", () => {
  const bot = new MeetingIntelligenceBot();
  const transcript =
    "Our current process today is manual and causes delays. " +
    "The problem is duplicate work and reporting errors. " +
    "The impact is £150k per quarter in wasted effort. " +
    "Our metric target is cutting onboarding time by 30%. " +
    "The economic buyer is the CFO and legal review is required. " +
    "Decision criteria include security and integration. " +
    "Next step is a follow-up workshop by Friday.";

  const result = bot.analyzeMeeting({ transcript, crmContext: { opportunityId: "OPP-1" } });

  assert.equal(result.meddpicc.metrics.status, "captured");
  assert.equal(result.meddpicc.economicBuyer.status, "captured");
  assert.equal(result.spin.problem.status, "captured");
  assert.equal(result.spin.implication.status, "captured");
  assert.ok(result.confidenceScore > 0);
  assert.equal(result.crmContext.opportunityId, "OPP-1");
});

test("analyzeMeeting flags missing economic buyer risk when absent", () => {
  const bot = new MeetingIntelligenceBot();
  const transcript =
    "Current process is manual and the team has delays. " +
    "The problem is data inconsistency and errors. " +
    "We need a better workflow for handoff.";

  const result = bot.analyzeMeeting({ transcript });
  const riskCodes = result.risks.map((risk) => risk.code);

  assert.ok(riskCodes.includes("MISSING_ECONOMIC_BUYER"));
  assert.equal(result.meddpicc.economicBuyer.status, "missing");
  assert.ok(result.gaps.meddpicc.some((gap) => gap.field === "economicBuyer"));
});
