// script.js — Frontend for Secure Gemini Chatbot

const container = document.querySelector(".container");
const chatsContainer = document.querySelector(".chats-container");
const promptForm = document.querySelector(".prompt-form");
const promptInput = promptForm.querySelector(".prompt-input");
const fileInput = promptForm.querySelector("#file-input");
const fileUploadWrapper = promptForm.querySelector(".file-upload-wrapper");
const deleteChatsBtn = document.querySelector("#delete-chats-btn");
const suggestions = document.querySelector(".suggestions");

let streamAbortController = null;

const MAX_HISTORY_LENGTH = 8;

const setInputState = (disabled) => {
  promptInput.disabled = disabled;
  promptForm.querySelector("#send-prompt-btn").disabled = disabled;
  promptInput.placeholder = disabled
    ? "AI is responding..."
    : "Ask Gemini";
};

const saveHistory = () => {
  localStorage.setItem("gemini_chat_history", JSON.stringify(chatHistory));
};

const loadHistory = () => {
  const saved = localStorage.getItem("gemini_chat_history");
  if (saved) chatHistory = JSON.parse(saved);
};


// const PROXY_API_URL = window.location.hostname === "localhost" ? "http://localhost:3000/api/generate" : "https://ai-chatbot-backend-vzzr.onrender.com/api/generate";

const PROXY_API_URL = "http://localhost:3000/api/generate";

let userMessage = "";
let chatHistory = [];
let attachedFile = null;

// Utility: Smooth scroll
const scrollToBottom = () =>
  chatsContainer.scrollTo({
    top: chatsContainer.scrollHeight,
    behavior: "smooth",
  });

// Utility: Convert markdown-ish Gemini output into readable HTML
const formatResponse = (rawText = "") => {
  return rawText
    // Headings
    .replace(/^##\s?(.*)$/gm, "<h3>$1</h3>")
    .replace(/^#\s?(.*)$/gm, "<h2>$1</h2>")
    // Bold, italics
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    // Inline code
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    // Blockquotes
    .replace(/^>\s?(.*)$/gm, "<blockquote>$1</blockquote>")
    // Lists
    .replace(/^\d+\.\s+(.*)$/gm, "<li>$1</li>")
    .replace(/^[-*]\s+(.*)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>)/gs, "<ul>$1</ul>")
    // Paragraphs and line breaks
    .replace(/\n{2,}/g, "</p><p>")
    .replace(/\n/g, "<br>")
    .trim();
};

// Utility: Create message element
const createMsgElement = (content, ...classes) => {
  const div = document.createElement("div");
  div.classList.add("message", ...classes);
  div.innerHTML = content;
  return div;
};

const typeWriter = (element, html, speed = 15) => {
  element.innerHTML = "";
  let i = 0;

  const typing = setInterval(() => {
    element.innerHTML += html.charAt(i);
    i++;
    scrollToBottom();

    if (i >= html.length) {
      clearInterval(typing);
    }
  }, speed);
};

const streamResponse = async ({ message, history, onChunk, onEnd, onError }) => {

  streamAbortController = new AbortController();
  const response = await fetch("http://localhost:3000/api/generate-stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history }),
    signal: streamAbortController.signal,
  });

  if (!response.ok || !response.body) {
    throw new Error("Streaming failed to start");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // SSE frames are separated by \n\n
    const frames = buffer.split("\n\n");
    buffer = frames.pop() || "";

    for (const frame of frames) {
      if (frame.startsWith("data: ")) {
        const data = frame.replace("data: ", "");
        try {
          const chunk = JSON.parse(data);
          onChunk(chunk);
        } catch {
          // ignore malformed chunks
        }
      } else if (frame.startsWith("event: end")) {
        onEnd();
        return;
      } else if (frame.startsWith("event: error")) {
        const dataLine = frame.split("\n").find(l => l.startsWith("data:"));
        const msg = dataLine ? dataLine.replace("data: ", "").replace(/"/g, "") : "STREAMING_NOT_AVAILABLE";
        onError(msg);
        return;
      }
    }
  }

  onEnd();
};

// const generateResponse = async (botMsgDiv) => {
//   const textElement = botMsgDiv.querySelector(".message-text");

//   chatHistory.push({
//     role: "user",
//     parts: [{ text: userMessage }],
//   });

//   try {
//     if (chatHistory.length > MAX_HISTORY_LENGTH) {
//       chatHistory = chatHistory.slice(-MAX_HISTORY_LENGTH);
//     }

//     const response = await fetch(PROXY_API_URL, {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({
//         message: userMessage,
//         history: chatHistory,
//       }),
//     });

//     const data = await response.json();
//     console.log("🎯 FULL API Response:", JSON.stringify(data, null, 2));

//     if (!response.ok) {
//       const errMsg = data.error || "Unexpected server error";
//       throw new Error(errMsg);
//     }

//     // Correct AI text from backend
//     const rawText = data.response || "⚠️ No response from server.";
//     const formattedHTML = formatResponse(rawText);

//     // Update frontend history with backend-updated history
//     chatHistory = data.updatedHistory || chatHistory;

//     saveHistory();

//     // Display formatted AI response
//     const safeHTML = DOMPurify.sanitize(formattedHTML);
//     typeWriter(textElement, safeHTML);

//     botMsgDiv.classList.remove("loading");
//     scrollToBottom();

//   } catch (error) {
//     console.error("❌ Error:", error);
//     textElement.innerHTML = `<p>Error: ${error.message}</p>`;
//     botMsgDiv.classList.remove("loading");
//   }
// };


const generateResponse = async (botMsgDiv) => {

  setInputState(true);

  const textElement = botMsgDiv.querySelector(".message-text");

  chatHistory.push({
    role: "user",
    parts: [{ text: userMessage }],
  });

  if (chatHistory.length > MAX_HISTORY_LENGTH) {
    chatHistory = chatHistory.slice(-MAX_HISTORY_LENGTH);
  }

  let accumulatedHTML = "";
  let accumulatedText = "";

  try {
    await streamResponse({
      message: userMessage,
      history: chatHistory,

      onChunk: (textChunk) => {
        accumulatedText += textChunk;

        // Show raw text temporarily (no formatting yet)
        textElement.textContent = accumulatedText;
        scrollToBottom();
      },

      onEnd: () => {
        setInputState(false);
        streamAbortController = null;
        botMsgDiv.classList.remove("loading");

        // FINAL normalization pass
        const normalized = accumulatedText
          .replace(/\\n/g, "\n")          // escaped newlines
          .replace(/\\\s*\n?/g, "\n")     // stray backslashes
          .replace(/\n{3,}/g, "\n\n")     // collapse noise
          .trim();

        // Convert to HTML
        const markdownHTML = marked.parse(normalized);
        textElement.innerHTML = DOMPurify.sanitize(markdownHTML);

        // Save CLEAN plain text
        chatHistory.push({
          role: "model",
          parts: [{ text: normalized }],
        });

        saveHistory();
      },

      onError: async (msg) => {
        setInputState(false);
        streamAbortController = null;
        botMsgDiv.classList.remove("loading");

        if (msg === "QUOTA_EXCEEDED") {
          textElement.innerHTML = `
            <p>⚠️ <strong>API limit reached</strong></p>
            <p>You’ve hit the free Gemini API quota.</p>
            <p>Please wait about a minute and try again.</p>
          `;
          return;
        }

        textElement.innerHTML = `<p>❌ Streaming unavailable</p>`;
      },
    });
  } catch (error) {
    setInputState(false);
    console.error("❌ Streaming Error:", error);
    textElement.innerHTML = `<p>Error: ${error.message}</p>`;
    botMsgDiv.classList.remove("loading");
  }
};

const handleFormSubmit = (e) => {
  e.preventDefault();
  userMessage = promptInput.value.trim();
  if (!userMessage) return;

  promptInput.value = "";

  const userMsgHTML = `<p class="message-text">${userMessage}</p>`;
  const userMsgDiv = createMsgElement(userMsgHTML, "user-message");
  chatsContainer.appendChild(userMsgDiv);

  if (suggestions) {
    suggestions.style.display = "none";
  }

  scrollToBottom();

  setTimeout(() => {
    const botMsgHTML = `
      <div class="bot-message-wrapper">
        <img src="gemini-logo.svg" class="avatar" alt="AI">
        <div class="bot-message message loading">
          <p class="message-text">AI is typing...</p>
        </div>
      </div>
    `;

    const botMsgDiv = createMsgElement(botMsgHTML, "bot-message", "loading");
    chatsContainer.appendChild(botMsgDiv);
    scrollToBottom();

    generateResponse(botMsgDiv);
  }, 500);
};

fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  if (!file) return;

  attachedFile = file;
  const isImage = file.type.startsWith("image/");
  const reader = new FileReader();

  reader.readAsDataURL(file);
  reader.onload = (e) => {
    fileInput.value = "";
    const preview = fileUploadWrapper.querySelector(".file-preview");
    preview.src = e.target.result;
    fileUploadWrapper.classList.add(
      "active",
      isImage ? "img-attached" : "file-attached"
    );
  };
});

document
  .querySelector("#cancel-file-btn")
  .addEventListener("click", () => {
    attachedFile = null;
    const preview = fileUploadWrapper.querySelector(".file-preview");
    preview.src = "#";
    fileUploadWrapper.classList.remove(
      "active",
      "img-attached",
      "file-attached"
    );
  });

promptForm.querySelector("#add-file-btn").addEventListener("click", () => {
  fileInput.click();
});

// Initialize form listener
promptForm.addEventListener("submit", handleFormSubmit);

loadHistory();

if (chatHistory.length > 0 && suggestions) {
  suggestions.style.display = "none";
}

deleteChatsBtn.addEventListener("click", () => {
  const confirmClear = confirm("Are you sure you want to delete all chats?");
  if (!confirmClear) return;

  // Clear UI
  chatsContainer.innerHTML = "";

  // Reset history
  chatHistory = [];
  localStorage.removeItem("gemini_chat_history");

  // Show suggestions again
  if (suggestions) {
    suggestions.style.display = "flex";
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && streamAbortController) {
    streamAbortController.abort();
    streamAbortController = null;
    setInputState(false);
  }
});
