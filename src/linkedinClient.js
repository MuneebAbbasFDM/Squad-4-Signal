"use strict";

const https = require("node:https");

/**
 * Fetches a LinkedIn profile via the RapidAPI LinkedIn Data API.
 *
 * Requires the following environment variables:
 *   LINKEDIN_API_KEY  – RapidAPI key (required; returns null when absent)
 *   LINKEDIN_API_HOST – RapidAPI host (optional; defaults to linkedin-data-api.p.rapidapi.com)
 *
 * @param {string} profileUrl – Full LinkedIn profile URL, e.g. https://www.linkedin.com/in/becky-davis
 * @returns {Promise<object|null>} Normalised profile object, or null when unavailable.
 */
function fetchLinkedInProfile(profileUrl) {
  const apiKey = process.env.LINKEDIN_API_KEY;
  if (!apiKey) return Promise.resolve(null);

  const apiHost = process.env.LINKEDIN_API_HOST || "linkedin-data-api.p.rapidapi.com";
  const encodedUrl = encodeURIComponent(profileUrl);

  return new Promise((resolve) => {
    const options = {
      hostname: apiHost,
      path: `/get-profile-data-by-url?url=${encodedUrl}`,
      method: "GET",
      headers: {
        "x-rapidapi-key": apiKey,
        "x-rapidapi-host": apiHost,
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          if (!parsed || parsed.message || parsed.error || (!parsed.firstName && !parsed.fullName && !parsed.full_name)) {
            resolve(null);
            return;
          }
          resolve(normaliseProfile(parsed));
        } catch {
          resolve(null);
        }
      });
    });

    req.on("error", () => resolve(null));
    req.setTimeout(8000, () => {
      req.destroy();
      resolve(null);
    });
    req.end();
  });
}

/**
 * Maps a raw RapidAPI LinkedIn response to a consistent shape used by the rest
 * of the application.
 */
function normaliseProfile(raw) {
  const firstName = raw.firstName || raw.first_name || "";
  const lastName = raw.lastName || raw.last_name || "";
  const fullName = (raw.fullName || raw.full_name || `${firstName} ${lastName}`).trim() || null;

  const positions = Array.isArray(raw.position)
    ? raw.position.slice(0, 3).map((p) => ({ title: p.title || null, company: p.companyName || null }))
    : [];

  const currentPosition = positions[0] || null;

  return {
    fullName,
    headline: raw.headline || raw.title || null,
    currentTitle: currentPosition?.title || raw.headline || null,
    company: raw.company || raw.currentCompany || currentPosition?.company || null,
    location: raw.location || raw.geo?.full || null,
    skills: Array.isArray(raw.skills)
      ? raw.skills.map((s) => (typeof s === "string" ? s : s.name)).filter(Boolean)
      : [],
    summary: raw.summary || raw.about || null,
    positions,
  };
}

module.exports = { fetchLinkedInProfile };
