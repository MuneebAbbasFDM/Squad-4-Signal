const form = document.getElementById("chat-form");
const input = document.getElementById("chat-input");
const messages = document.getElementById("messages");
const statusText = document.getElementById("status");
const sendButton = document.getElementById("send-button");

let crmContext = {};

function addMessage(role, text) {
  const node = document.createElement("div");
  node.className = `message ${role}`;
  node.textContent = text;
  messages.appendChild(node);
  messages.scrollTop = messages.scrollHeight;
}

async function sendMessage(message) {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, crmContext }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Request failed.");
  }

  if (data.crmContext && typeof data.crmContext === "object") {
    crmContext = data.crmContext;
  }

  return data.reply;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  statusText.textContent = "";

  const message = input.value.trim();
  if (!message) {
    statusText.textContent = "Please enter a message.";
    return;
  }

  addMessage("user", message);
  input.value = "";
  sendButton.disabled = true;
  statusText.textContent = "Thinking...";

  try {
    const reply = await sendMessage(message);
    addMessage("bot", reply);
    statusText.textContent = "";
  } catch (error) {
    statusText.textContent = error.message || "Unexpected error.";
  } finally {
    sendButton.disabled = false;
    input.focus();
  }
});
