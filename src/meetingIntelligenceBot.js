"use strict";

const { generateChatResponse, generateAnalysisInsights } = require("./aiEngine");
const { buildCrmSummary } = require("./crmData");

const MEDDPICC = {
  metrics: {
    keywords: ["metric", "kpi", "roi", "revenue", "cost", "save", "target"],
    followUpQuestion: "What measurable business outcome and target value are agreed?",
  },
  economicBuyer: {
    keywords: ["economic buyer", "budget owner", "cfo", "vp finance", "final signer"],
    followUpQuestion: "Who is the economic buyer and how can we validate direct access?",
  },
  decisionCriteria: {
    keywords: ["decision criteria", "must have", "evaluation criteria", "selection criteria"],
    followUpQuestion: "What criteria will be used to evaluate and select a solution?",
  },
  decisionProcess: {
    keywords: ["decision process", "approval flow", "steps to decide", "timeline to decide"],
    followUpQuestion: "What is the documented decision process and timeline?",
  },
  paperProcess: {
    keywords: ["legal", "procurement", "msa", "security review", "contract"],
    followUpQuestion: "What contract/procurement steps are required and who owns each step?",
  },
  identifiedPain: {
    keywords: ["pain", "challenge", "problem", "issue", "bottleneck", "risk"],
    followUpQuestion: "What critical pain is prioritised and what is the impact today?",
  },
  champion: {
    keywords: ["champion", "advocate", "internal sponsor", "supports us"],
    followUpQuestion: "Who is the champion and how are they influencing the internal process?",
  },
  competition: {
    keywords: ["competitor", "alternative", "incumbent", "build internally", "status quo"],
    followUpQuestion: "What alternatives or competitors are being considered?",
  },
};

const SPIN = {
  situation: {
    keywords: ["current", "today", "existing", "environment", "team size", "process today"],
    followUpQuestion: "What is the current situation and baseline operating model?",
  },
  problem: {
    keywords: ["problem", "issue", "friction", "manual", "delay", "error"],
    followUpQuestion: "What core problems are blocking progress?",
  },
  implication: {
    keywords: ["impact", "implication", "consequence", "risk if", "cost of delay"],
    followUpQuestion: "What is the quantified implication if the problem remains unsolved?",
  },
  needPayoff: {
    keywords: ["need-payoff", "value", "benefit", "outcome", "would enable"],
    followUpQuestion: "What measurable payoff is expected from solving this now?",
  },
};

const ABBREVIATIONS = [
  [/\bEB\b/gi, "economic buyer"],
  [/\bDC\b/gi, "decision criteria"],
  [/\bDP\b/gi, "decision process"],
  [/\bPP\b/gi, "paper process"],
  [/\bNP\b/gi, "need-payoff"],
];

function normaliseText(text) {
  return ABBREVIATIONS.reduce((value, [pattern, replacement]) => value.replace(pattern, replacement), text);
}

function splitSentences(text) {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function extractCoverage(transcript, frameworkMap) {
  const sentences = splitSentences(transcript);
  const result = {};

  for (const [field, config] of Object.entries(frameworkMap)) {
    const evidence = sentences.filter((sentence) => {
      const lower = sentence.toLowerCase();
      return config.keywords.some((keyword) => lower.includes(keyword));
    });

    result[field] = {
      status: evidence.length > 0 ? "captured" : "missing",
      evidence,
      strength: evidence.length > 1 ? "strong" : evidence.length === 1 ? "weak" : "none",
      followUpQuestion: evidence.length > 0 ? null : config.followUpQuestion,
    };
  }

  return result;
}

function flattenMissing(coverage) {
  return Object.entries(coverage)
    .filter(([, detail]) => detail.status === "missing")
    .map(([field, detail]) => ({
      field,
      followUpQuestion: detail.followUpQuestion,
    }));
}

function buildRisks(meddpiccCoverage, transcript) {
  const risks = [];

  if (meddpiccCoverage.economicBuyer.status === "missing") {
    risks.push({
      code: "MISSING_ECONOMIC_BUYER",
      severity: "high",
      message: "Economic Buyer not confirmed.",
    });
  }

  if (meddpiccCoverage.metrics.status === "missing") {
    risks.push({
      code: "UNQUANTIFIED_PAIN",
      severity: "medium",
      message: "No quantified metrics tied to pain/outcome.",
    });
  }

  if (meddpiccCoverage.decisionCriteria.status === "missing") {
    risks.push({
      code: "UNCLEAR_DECISION_CRITERIA",
      severity: "medium",
      message: "Decision criteria are unclear.",
    });
  }

  if (meddpiccCoverage.champion.status === "missing") {
    risks.push({
      code: "UNCONFIRMED_CHAMPION",
      severity: "medium",
      message: "Champion not confirmed.",
    });
  }

  const lower = transcript.toLowerCase();
  const hasNextSteps = ["next step", "follow-up", "follow up", "by friday", "by next", "action item"].some((key) =>
    lower.includes(key),
  );
  if (!hasNextSteps) {
    risks.push({
      code: "NO_CLEAR_NEXT_STEPS",
      severity: "low",
      message: "No clear next steps captured in the transcript.",
    });
  }

  return risks;
}

function computeConfidenceScore(...coverageMaps) {
  let total = 0;
  let captured = 0;

  for (const map of coverageMaps) {
    for (const detail of Object.values(map)) {
      total += 1;
      if (detail.status === "captured") captured += 1;
    }
  }

  return total === 0 ? 0 : Math.round((captured / total) * 100);
}

function createMissingHighlights(gaps) {
  const meddpicc = gaps.meddpicc.map((gap) => gap.field);
  const spin = gaps.spin.map((gap) => gap.field);
  const summaryParts = [];

  if (meddpicc.length > 0) {
    summaryParts.push(`Missing MEDDPICC: ${meddpicc.join(", ")}.`);
  }

  if (spin.length > 0) {
    summaryParts.push(`Missing SPIN: ${spin.join(", ")}.`);
  }

  if (summaryParts.length === 0) {
    summaryParts.push("No missing MEDDPICC or SPIN elements detected.");
  }

  return {
    meddpicc,
    spin,
    summary: summaryParts.join(" "),
  };
}

function createSummary(confidenceScore, risks, meddpiccCoverage, spinCoverage, missingHighlights) {
  const coveredMeddpicc = Object.values(meddpiccCoverage).filter((f) => f.status === "captured").length;
  const coveredSpin = Object.values(spinCoverage).filter((f) => f.status === "captured").length;

  return [
    `Discovery confidence score: ${confidenceScore}%.`,
    `MEDDPICC coverage: ${coveredMeddpicc}/8.`,
    `SPIN coverage: ${coveredSpin}/4.`,
    risks.length ? `Open risks detected: ${risks.length}.` : "No immediate framework risks detected.",
    missingHighlights.summary,
  ].join(" ");
}

function createMeetingPlan(linkedinProfile) {
  const crmSummary = buildCrmSummary(linkedinProfile);
  const primaryChallenge = crmSummary.topChallenges[0] || "Discovery and delivery alignment risk.";
  const primaryDecision = crmSummary.recentDecisions[0] || "No explicit decision trend captured.";
  const primaryNextStep = crmSummary.likelyNextSteps[0] || "Confirm next-step owner and due date.";

  return {
    objective: `Prepare for next ${crmSummary.account} stakeholder meeting with structured MEDDPICC/SPIN discovery.`,
    linkedinProfile,
    crmSummary,
    meddpiccPlan: {
      metrics: `Quantify impact linked to: ${primaryChallenge}`,
      economicBuyer: `Confirm budget authority and access path${crmSummary.stakeholder ? ` via ${crmSummary.stakeholder}` : ""}.`,
      decisionCriteria: "Validate hiring-quality, speed, and compliance criteria.",
      decisionProcess: "Map approval flow, timeline, and gate owners.",
      paperProcess: "Confirm legal/procurement process and expected contract checkpoints.",
      identifiedPain: `Probe urgency behind repeated challenge: ${primaryChallenge}`,
      champion: "Identify who will actively advocate internally and why.",
      competition: "Test whether incumbents, alternatives, or status quo are preferred.",
    },
    spinPlan: {
      situation: `Current operating context from CRM notes: ${crmSummary.keyDiscussionPoints[0] || "Validate current hiring process and team constraints."}`,
      problem: `Clarify root problem behind: ${primaryChallenge}`,
      implication: "Quantify cost of delay on delivery timelines and stakeholder confidence.",
      needPayoff: `Align expected value to likely action: ${primaryNextStep}`,
    },
    meetingAgenda: [
      "Recap account context and confirm current priorities.",
      "Run MEDDPICC discovery to close qualification gaps.",
      "Run SPIN questions to deepen business impact and urgency.",
      `Reconfirm or update latest decision trend: ${primaryDecision}`,
      `Agree owner and date for next step: ${primaryNextStep}`,
    ],
  };
}

class MeetingIntelligenceBot {
  async analyzeMeeting({ transcript, crmContext = {} }) {
    if (!transcript || typeof transcript !== "string" || transcript.trim().length === 0) {
      throw new Error("A non-empty transcript string is required.");
    }

    const normalisedTranscript = normaliseText(transcript);
    const meddpiccCoverage = extractCoverage(normalisedTranscript, MEDDPICC);
    const spinCoverage = extractCoverage(normalisedTranscript, SPIN);

    const gaps = {
      meddpicc: flattenMissing(meddpiccCoverage),
      spin: flattenMissing(spinCoverage),
    };

    const risks = buildRisks(meddpiccCoverage, normalisedTranscript);
    const confidenceScore = computeConfidenceScore(meddpiccCoverage, spinCoverage);
    const missingHighlights = createMissingHighlights(gaps);
    const summary = createSummary(confidenceScore, risks, meddpiccCoverage, spinCoverage, missingHighlights);

    const structuredResult = {
      summary,
      confidenceScore,
      crmContext,
      meddpicc: meddpiccCoverage,
      spin: spinCoverage,
      gaps,
      missingHighlights,
      risks,
      nextSteps: this.suggestNextSteps(gaps),
      evidenceTraceability: "All extracted items include sentence-level evidence from the transcript.",
    };

    const aiInsights = await generateAnalysisInsights(transcript, structuredResult);
    if (aiInsights) {
      structuredResult.aiInsights = aiInsights;
    }

    return structuredResult;
  }

  suggestNextSteps(gaps) {
    return [...gaps.meddpicc, ...gaps.spin].map((gap) => gap.followUpQuestion).filter(Boolean);
  }

  async chat(message, state = {}) {
    if (!message || typeof message !== "string") {
      return "Please share a message or use /analyze <meeting transcript>.";
    }

    if (message.trim() === "/help") {
      return "Use /analyze <meeting transcript> for analysis, /plan <linkedin-profile-url> for a MEDDPICC/SPIN meeting plan from legal_general_crm_notes_12m.xlsx data, and /context <json> to attach CRM context.";
    }

    if (message.trim().startsWith("/analyze")) {
      const transcript = message.replace("/analyze", "").trim();
      if (!transcript) {
        return "Please include transcript text after /analyze.";
      }
      const analysis = await this.analyzeMeeting({ transcript, crmContext: state.crmContext || {} });
      return JSON.stringify(analysis, null, 2);
    }

    if (message.trim().startsWith("/plan")) {
      const linkedinProfile = message.replace("/plan", "").trim();
      if (!linkedinProfile) {
        return "Please provide a LinkedIn profile URL after /plan so I can tailor the meeting plan.";
      }
      if (!/^https?:\/\/(www\.)?linkedin\.com\/.+/i.test(linkedinProfile)) {
        return "Please provide a valid LinkedIn profile URL (for example: https://www.linkedin.com/in/example).";
      }
      return JSON.stringify(createMeetingPlan(linkedinProfile), null, 2);
    }

    const aiReply = await generateChatResponse(message, state.crmContext || {});
    if (aiReply) {
      return aiReply;
    }

    return "I can help with discovery intelligence. Use /analyze <meeting transcript> to generate MEDDPICC/SPIN insights.";
  }
}

module.exports = {
  MeetingIntelligenceBot,
  normaliseText,
};
