"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createServer } = require("../src/server");

async function withServer(run) {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    await run(baseUrl);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("POST /api/chat returns reply for normal message", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "/help", crmContext: {} }),
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.match(body.reply, /Use \/analyze/i);
  });
});

test("POST /api/chat supports /context command", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: '/context {"opportunityId":"OPP-12"}', crmContext: {} }),
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.reply, "CRM context updated.");
    assert.equal(body.crmContext.opportunityId, "OPP-12");
  });
});

test("POST /api/chat rejects invalid payloads", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "" }),
    });

    assert.equal(response.status, 400);
    const body = await response.json();
    assert.match(body.error, /non-empty message/i);
  });
});

test("POST /api/chat supports /plan command", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "/plan https://www.linkedin.com/in/becky-davis", crmContext: {} }),
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    const plan = JSON.parse(body.reply);
    assert.equal(plan.crmSummary.sourceFile, "legal_general_crm_notes_12m.xlsx");
    assert.ok(plan.meddpiccPlan.economicBuyer.length > 0);
  });
});
