const chatsContainer = document.querySelector(".chats-container");
const promptForm = document.querySelector(".prompt-form");
const promptInput = document.querySelector(".prompt-input");
const fileInput = document.querySelector("#file-input");
const filePreviewContainer = document.querySelector(".file-preview-container");
const welcomeScreen = document.querySelector(".welcome-screen");
const sendBtn = document.querySelector("#send-prompt-btn");
const modelSelect = document.querySelector("#model-select");

let userMessage = null;
let attachedFile = null; 
let isGenerating = false;
let abortController = null;
let chatHistory = [];

// Determine API URL based on environment
const API_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:3000/api/generate-stream' 
    : 'https://ai-chatbot-backend-vzzr.onrender.com/api/generate-stream';

const toggleWelcomeScreen = () => {
    if (chatHistory.length > 0 || isGenerating) {
        welcomeScreen.classList.add("hidden");
    } else {
        welcomeScreen.classList.remove("hidden");
    }
};

const updateSendBtnState = () => {
    if (promptInput.value.trim() || attachedFile) {
        sendBtn.classList.add("active");
    } else {
        sendBtn.classList.remove("active");
    }
};

promptInput.addEventListener("input", updateSendBtnState);

// --- File Handling ---
fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        // Essential: Extract only the base64 part, removing "data:image/png;base64,"
        const base64Data = e.target.result.split(',')[1]; 
        
        attachedFile = {
            data: base64Data,
            mime: file.type,
            preview: e.target.result
        };

        filePreviewContainer.querySelector(".file-preview-img").src = e.target.result;
        filePreviewContainer.classList.add("active");
        updateSendBtnState();
    };
    reader.readAsDataURL(file);
});

document.querySelector("#cancel-file-btn").addEventListener("click", () => {
    attachedFile = null;
    fileInput.value = "";
    filePreviewContainer.classList.remove("active");
    updateSendBtnState();
});

document.querySelector("#add-file-btn").addEventListener("click", () => fileInput.click());

// --- Chat Logic ---

const createMessageElement = (html, type) => {
    const div = document.createElement("div");
    div.classList.add("message", type);
    div.innerHTML = html;
    return div;
};

const scrollToBottom = () => {
    // Force scroll to bottom immediately
    chatsContainer.scrollTop = chatsContainer.scrollHeight;
};

const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (isGenerating) return;

    userMessage = promptInput.value.trim();
    if (!userMessage && !attachedFile) return;

    isGenerating = true;
    promptInput.value = "";
    promptInput.disabled = true;
    toggleWelcomeScreen();
    
    // Render User Message
    const userHtml = `
        <div class="message-content">
            ${attachedFile ? `<img src="${attachedFile.preview}" style="max-width:200px; border-radius:12px; margin-bottom:10px; display:block;">` : ''}
            <p class="message-text">${userMessage.replace(/\n/g, "<br>")}</p>
        </div>
    `;
    chatsContainer.appendChild(createMessageElement(userHtml, "user-message"));
    scrollToBottom();

    // Reset File UI
    const currentImage = attachedFile; // Store temporarily for API call
    attachedFile = null;
    filePreviewContainer.classList.remove("active");
    updateSendBtnState();

    // Render Bot Skeleton
    const botHtml = `
        <img src="https://www.gstatic.com/lamda/images/gemini_sparkle_v002_d4735304ff6292a690345.svg" class="avatar">
        <div class="message-content">
            <p class="message-text">Thinking...</p>
        </div>
    `;
    const botMsgDiv = createMessageElement(botHtml, "bot-message");
    botMsgDiv.classList.add("loading");
    chatsContainer.appendChild(botMsgDiv);
    scrollToBottom();

    const textElement = botMsgDiv.querySelector(".message-text");

    try {
        abortController = new AbortController();
        const response = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                message: userMessage,
                history: chatHistory,
                model: modelSelect.value,
                // Ensure image structure matches exactly what Google SDK expects
                image: currentImage ? { inlineData: { data: currentImage.data, mimeType: currentImage.mime } } : null
            }),
            signal: abortController.signal
        });

        if (!response.ok) throw new Error("API Error");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulatedText = "";
        
        textElement.innerHTML = ""; 
        botMsgDiv.classList.remove("loading");

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split("\n");
            
            for (const line of lines) {
                if (line.startsWith("data: ") && line !== "data: [DONE]") {
                    try {
                        const jsonStr = line.replace("data: ", "");
                        const textChunk = JSON.parse(jsonStr);
                        
                        accumulatedText += textChunk;
                        // Render with Markdown
                        textElement.innerHTML = marked.parse(accumulatedText);
                        
                        // Scroll automatically while generating
                        scrollToBottom(); 
                    } catch (e) {
                        // Ignore parse errors for partial chunks
                    }
                }
            }
        }

        chatHistory.push({ role: "user", parts: [{ text: userMessage }] });
        chatHistory.push({ role: "model", parts: [{ text: accumulatedText }] });

    } catch (error) {
        textElement.innerHTML = `<span style="color:#ff8a80">Error: ${error.message}</span>`;
        botMsgDiv.classList.remove("loading");
    } finally {
        isGenerating = false;
        promptInput.disabled = false;
        promptInput.focus();
        abortController = null;
    }
};

promptForm.addEventListener("submit", handleFormSubmit);

// Handle Suggestion Clicks
document.querySelectorAll(".suggestions-item").forEach(item => {
    item.addEventListener("click", () => {
        const text = item.querySelector(".text").innerText;
        promptInput.value = text;
        updateSendBtnState();
        promptForm.dispatchEvent(new Event("submit"));
    });
});

// Theme Toggle
document.querySelector("#theme-toggle-btn").addEventListener("click", () => {
    document.body.classList.toggle("light-mode");
});

// Delete Chats
document.querySelector("#delete-chats-btn").addEventListener("click", () => {
    if (confirm("Delete all chat history?")) {
        chatsContainer.innerHTML = "";
        chatHistory = [];
        toggleWelcomeScreen();
    }
});