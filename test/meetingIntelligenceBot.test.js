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

test("analyzeMeeting returns captured framework coverage for relevant evidence", async () => {
  const bot = new MeetingIntelligenceBot();
  const transcript =
    "Our current process today is manual and causes delays. " +
    "The problem is duplicate work and reporting errors. " +
    "The impact is £150k per quarter in wasted effort. " +
    "Our metric target is cutting onboarding time by 30%. " +
    "The economic buyer is the CFO and legal review is required. " +
    "Decision criteria include security and integration. " +
    "Next step is a follow-up workshop by Friday.";

  const result = await bot.analyzeMeeting({ transcript, crmContext: { opportunityId: "OPP-1" } });

  assert.equal(result.meddpicc.metrics.status, "captured");
  assert.equal(result.meddpicc.economicBuyer.status, "captured");
  assert.equal(result.spin.problem.status, "captured");
  assert.equal(result.spin.implication.status, "captured");
  assert.ok(Array.isArray(result.missingHighlights.meddpicc));
  assert.ok(Array.isArray(result.missingHighlights.spin));
  assert.ok(result.confidenceScore > 0);
  assert.equal(result.crmContext.opportunityId, "OPP-1");
});

test("analyzeMeeting flags missing economic buyer risk when absent", async () => {
  const bot = new MeetingIntelligenceBot();
  const transcript =
    "Current process is manual and the team has delays. " +
    "The problem is data inconsistency and errors. " +
    "We need a better workflow for handoff.";

  const result = await bot.analyzeMeeting({ transcript });
  const riskCodes = result.risks.map((risk) => risk.code);

  assert.ok(riskCodes.includes("MISSING_ECONOMIC_BUYER"));
  assert.equal(result.meddpicc.economicBuyer.status, "missing");
  assert.ok(result.gaps.meddpicc.some((gap) => gap.field === "economicBuyer"));
  assert.ok(result.missingHighlights.meddpicc.includes("economicBuyer"));
  assert.match(result.summary, /Missing MEDDPICC: .*economicBuyer/i);
});

test("chat /plan asks for stakeholder name when missing", async () => {
  const bot = new MeetingIntelligenceBot();
  const reply = await bot.chat("/plan");
  assert.match(reply, /stakeholder name/i);
});

test("chat /plan returns MEDDPICC and SPIN meeting plan", async () => {
  const bot = new MeetingIntelligenceBot();
  const reply = await bot.chat("/plan Becky Davis");
  const parsed = JSON.parse(reply);

  assert.equal(parsed.stakeholder, "Becky Davis");
  assert.equal(parsed.crmSummary.sourceFile, "legal_general_crm_notes_12m.xlsx");
  assert.ok(parsed.meddpiccPlan.metrics.length > 0);
  assert.ok(parsed.spinPlan.problem.length > 0);
  assert.ok(Array.isArray(parsed.meetingAgenda));
});

test("chat /plan rejects unsupported stakeholder names", async () => {
  const bot = new MeetingIntelligenceBot();
  const reply = await bot.chat("/plan Jane Doe");
  assert.match(reply, /supported stakeholder names/i);
});
