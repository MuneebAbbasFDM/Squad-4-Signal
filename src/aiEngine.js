"use strict";

const { OpenAI } = require("openai");

const SYSTEM_PROMPT = `You are an expert sales coaching assistant specialising in MEDDPICC and SPIN selling methodologies.
You help sales representatives analyse their discovery meetings, identify gaps in qualification, and generate coaching recommendations.

MEDDPICC covers: Metrics, Economic Buyer, Decision Criteria, Decision Process, Paper Process, Identified Pain, Champion, Competition.
SPIN covers: Situation, Problem, Implication, Need-Payoff.

Always be concise, specific, and actionable. When asked to analyse a transcript, focus on what is confirmed, what is missing, and what risks that creates.`;

let _client = null;

function getClient() {
  if (_client) return _client;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  _client = new OpenAI({ apiKey });
  return _client;
}

async function generateChatResponse(userMessage, crmContext = {}) {
  const openai = getClient();
  if (!openai) return null;

  const contextBlock =
    crmContext && Object.keys(crmContext).length > 0
      ? `\nCRM context: ${JSON.stringify(crmContext)}`
      : "";

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: SYSTEM_PROMPT + contextBlock },
      { role: "user", content: userMessage },
    ],
    temperature: 0.4,
    max_tokens: 600,
  });

  return response.choices[0].message.content;
}

async function generateAnalysisInsights(transcript, structuredAnalysis) {
  const openai = getClient();
  if (!openai) return null;

  const missingMeddpicc = Object.entries(structuredAnalysis.meddpicc)
    .filter(([, v]) => v.status === "missing")
    .map(([k]) => k);

  const missingSpin = Object.entries(structuredAnalysis.spin)
    .filter(([, v]) => v.status === "missing")
    .map(([k]) => k);

  const prompt =
    `Analyse the following sales meeting transcript through the lens of MEDDPICC and SPIN selling.\n\n` +
    `Transcript:\n${transcript}\n\n` +
    `Structured analysis has already detected:\n` +
    `- Missing MEDDPICC elements: ${missingMeddpicc.length ? missingMeddpicc.join(", ") : "none"}\n` +
    `- Missing SPIN elements: ${missingSpin.length ? missingSpin.join(", ") : "none"}\n` +
    `- Confidence score: ${structuredAnalysis.confidenceScore}%\n\n` +
    `Provide a concise coaching narrative (3-5 sentences) covering: what the rep did well, the most critical qualification gaps, and the single most important next action to advance the deal.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
    temperature: 0.3,
    max_tokens: 400,
  });

  return response.choices[0].message.content;
}

module.exports = { generateChatResponse, generateAnalysisInsights };
