"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { MeetingIntelligenceBot } = require("./meetingIntelligenceBot");

const bot = new MeetingIntelligenceBot();
const PUBLIC_DIR = path.join(__dirname, "..", "public");

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1e6) {
        reject(new Error("Request body too large."));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function serveStatic(req, res) {
  const parsedUrl = new URL(req.url, "http://localhost");
  const rawPath = parsedUrl.pathname === "/" ? "index.html" : decodeURIComponent(parsedUrl.pathname).replace(/^\/+/, "");
  const filePath = path.join(PUBLIC_DIR, rawPath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    const ext = path.extname(filePath);
    const contentType =
      ext === ".html"
        ? "text/html; charset=utf-8"
        : ext === ".css"
          ? "text/css; charset=utf-8"
          : ext === ".js"
            ? "application/javascript; charset=utf-8"
            : "text/plain; charset=utf-8";

    res.writeHead(200, { "Content-Type": contentType });
    res.end(data);
  });
}

async function handleChat(req, res) {
  try {
    const body = await parseBody(req);
    const payload = body ? JSON.parse(body) : {};
    const { message, crmContext = {} } = payload;

    if (typeof message !== "string" || message.trim().length === 0) {
      sendJson(res, 400, { error: "A non-empty message string is required." });
      return;
    }

    if (message.trim().startsWith("/context")) {
      const raw = message.replace("/context", "").trim();
      try {
        const updatedContext = raw ? JSON.parse(raw) : {};
        sendJson(res, 200, { reply: "CRM context updated.", crmContext: updatedContext });
      } catch {
        sendJson(res, 400, { error: "Invalid JSON for /context.", crmContext });
      }
      return;
    }

    const reply = bot.chat(message, { crmContext });
    sendJson(res, 200, { reply, crmContext });
  } catch (error) {
    if (error instanceof SyntaxError) {
      sendJson(res, 400, { error: "Invalid JSON payload." });
      return;
    }
    sendJson(res, 500, { error: error.message || "Unexpected server error." });
  }
}

function createServer() {
  return http.createServer(async (req, res) => {
    if (req.method === "POST" && req.url === "/api/chat") {
      await handleChat(req, res);
      return;
    }

    if (req.method === "GET") {
      serveStatic(req, res);
      return;
    }

    res.writeHead(405);
    res.end("Method Not Allowed");
  });
}

if (require.main === module) {
  const server = createServer();
  const port = process.env.PORT || 3000;
  server.listen(port, () => {
    console.log(`Chatbot web server running at http://localhost:${port}`);
  });
}

module.exports = {
  createServer,
};
