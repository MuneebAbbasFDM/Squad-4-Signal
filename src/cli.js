"use strict";

const readline = require("node:readline");
const { MeetingIntelligenceBot } = require("./meetingIntelligenceBot");

const bot = new MeetingIntelligenceBot();
let crmContext = {};

function printHelp() {
  console.log("Commands:");
  console.log("  /help                         Show commands");
  console.log("  /context <json>               Set CRM context for analysis");
  console.log("  /analyze <transcript>         Analyze a meeting transcript");
  console.log("  /exit                         Exit chatbot");
}

function runSingleAnalysis(transcript) {
  try {
    const result = bot.analyzeMeeting({ transcript, crmContext });
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exitCode = 1;
  }
}

if (process.argv[2] === "--analyze") {
  runSingleAnalysis(process.argv.slice(3).join(" "));
} else {
  console.log("Sales Meeting Intelligence Assistant");
  printHelp();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "> ",
  });

  rl.prompt();
  rl.on("line", (line) => {
    const input = line.trim();
    if (!input) return rl.prompt();

    if (input === "/exit") {
      rl.close();
      return;
    }

    if (input === "/help") {
      printHelp();
      rl.prompt();
      return;
    }

    if (input.startsWith("/context")) {
      const raw = input.replace("/context", "").trim();
      try {
        crmContext = raw ? JSON.parse(raw) : {};
        console.log("CRM context updated.");
      } catch {
        console.log("Invalid JSON for /context.");
      }
      rl.prompt();
      return;
    }

    const response = bot.chat(input, { crmContext });
    console.log(response);
    rl.prompt();
  });

  rl.on("close", () => {
    console.log("Goodbye.");
  });
}
