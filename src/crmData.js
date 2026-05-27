"use strict";

const crmNotes = require("./data/legal_general_crm_notes_12m.json");

function parseDate(value) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function sortByDateDesc(records) {
  return [...records].sort((a, b) => {
    const aDate = parseDate(a["Meeting Date"]);
    const bDate = parseDate(b["Meeting Date"]);
    if (!aDate && !bDate) return 0;
    if (!aDate) return 1;
    if (!bDate) return -1;
    return bDate.getTime() - aDate.getTime();
  });
}

function countBy(records, key) {
  const counts = new Map();
  for (const record of records) {
    const value = record[key];
    if (!value || typeof value !== "string") continue;
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([value]) => value);
}

function normaliseName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function findRecordsByProfile(linkedinProfile) {
  let profileValue = String(linkedinProfile || "").trim().toLowerCase();
  while (profileValue.endsWith("/")) {
    profileValue = profileValue.slice(0, -1);
  }
  const lastSlash = profileValue.lastIndexOf("/");
  const pathSegment = lastSlash >= 0 ? profileValue.slice(lastSlash + 1) : profileValue;

  const nameHint = normaliseName(pathSegment.replace(/[0-9]/g, "").replace(/[-_]+/g, " "));
  const records = crmNotes.records || [];
  const matched = nameHint
    ? records.filter((record) => normaliseName(record["Client Name"]).includes(nameHint))
    : [];

  return matched.length > 0 ? matched : records;
}

function buildCrmSummary(linkedinProfile) {
  const filtered = sortByDateDesc(findRecordsByProfile(linkedinProfile));
  const recent = filtered.slice(0, 3);

  return {
    sourceFile: crmNotes.sourceFile,
    account: filtered[0]?.Account || "Legal & General",
    stakeholder: filtered[0]?.["Client Name"] || null,
    recordsAnalysed: filtered.length,
    recentMeetingDates: recent.map((record) => record["Meeting Date"]).filter(Boolean),
    keyDiscussionPoints: [...new Set(recent.map((record) => record["Key Discussion Points"]).filter(Boolean))],
    topChallenges: countBy(filtered, "Challenges Identified").slice(0, 3),
    recentDecisions: countBy(filtered, "Decisions Made").slice(0, 3),
    likelyNextSteps: countBy(filtered, "Next Steps").slice(0, 3),
  };
}

module.exports = {
  buildCrmSummary,
};
