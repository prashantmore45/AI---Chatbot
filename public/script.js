const chatsContainer = document.querySelector(".chats-container");
const promptForm = document.querySelector(".prompt-form");
const promptInput = document.querySelector(".prompt-input");
const fileInput = document.querySelector("#file-input");
const filePreviewContainer = document.querySelector(".file-preview-container");
const welcomeScreen = document.querySelector(".welcome-screen");
const sendBtn = document.querySelector("#send-prompt-btn");
const modelSelect = document.querySelector("#model-select");

// --- Markdown & Highlight Configuration ---
const renderer = new marked.Renderer();
renderer.code = ({ text, lang }) => {
    const validLang = !!(lang && hljs.getLanguage(lang)) ? lang : 'plaintext';
    const highlighted = hljs.highlight(text, { language: validLang }).value;
    return `<div class="code-block-wrapper"><div class="code-header"><span class="code-lang">${validLang}</span><button class="copy-btn" onclick="copyCode(this)"><span class="material-symbols-rounded">content_copy</span> Copy</button></div><pre><code class="hljs ${validLang}">${highlighted}</code></pre></div>`;
};
marked.use({ renderer });

window.copyCode = (btn) => {
    const text = btn.closest('.code-block-wrapper').querySelector('code').innerText;
    navigator.clipboard.writeText(text).then(() => {
        const originalHtml = btn.innerHTML;
        btn.innerHTML = `<span class="material-symbols-rounded">check</span> Copied!`;
        btn.classList.add('copied');
        setTimeout(() => { btn.innerHTML = originalHtml; btn.classList.remove('copied'); }, 2000);
    });
};

let userMessage = null;
let attachedFile = null; 
let isGenerating = false;
let abortController = null;
let chatHistory = [];

const API_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:3000/api/generate-stream' 
    : 'https://ai-chatbot-backend-vzzr.onrender.com/api/generate-stream';

// --- VISIBILITY LOGIC (UPDATED) ---
const toggleWelcomeScreen = () => {
    if (chatHistory.length > 0 || isGenerating) {
        welcomeScreen.style.display = "none";
        chatsContainer.style.display = "flex"; // Unhide chat container
    } else {
        welcomeScreen.style.display = "flex";
        chatsContainer.style.display = "none"; // Hide chat container
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
        const base64Data = e.target.result.split(',')[1]; 
        attachedFile = { data: base64Data, mime: file.type, preview: e.target.result };
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
    
    // Toggle Visibility immediately
    toggleWelcomeScreen();

    const userHtml = `<div class="message-content">${attachedFile ? `<img src="${attachedFile.preview}" style="max-width:200px; border-radius:12px; margin-bottom:10px; display:block;">` : ''}<p class="message-text">${userMessage.replace(/\n/g, "<br>")}</p></div>`;
    chatsContainer.appendChild(createMessageElement(userHtml, "user-message"));
    scrollToBottom();

    const currentImage = attachedFile;
    attachedFile = null;
    filePreviewContainer.classList.remove("active");
    updateSendBtnState();

    const botHtml = `<div class="bot-message message"><img src="https://www.gstatic.com/lamda/images/gemini_sparkle_v002_d4735304ff6292a690345.svg" class="avatar"><div class="message-content"><div class="message-text">Thinking...</div><button class="speak-btn" onclick="speakText(this)"><span class="material-symbols-rounded">volume_up</span></button></div></div>`;
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
                        accumulatedText += JSON.parse(jsonStr);
                        textElement.innerHTML = marked.parse(accumulatedText, { breaks: true });
                        scrollToBottom(); 
                    } catch (e) {}
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

document.querySelectorAll(".suggestions-item").forEach(item => {
    item.addEventListener("click", () => {
        promptInput.value = item.querySelector(".text").innerText;
        updateSendBtnState();
        promptForm.dispatchEvent(new Event("submit"));
    });
});

document.querySelector("#theme-toggle-btn").addEventListener("click", () => document.body.classList.toggle("light-mode"));
document.querySelector("#delete-chats-btn").addEventListener("click", () => {
    if (confirm("Delete all chat history?")) {
        chatsContainer.innerHTML = "";
        chatHistory = [];
        toggleWelcomeScreen();
    }
});


// 🎙️ VOICE FEATURES

const micBtn = document.querySelector("#mic-btn");

// 1. Browser Support Check
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (SpeechRecognition) {
    const recognition = new SpeechRecognition();
    recognition.continuous = false; 
    recognition.lang = 'en-US'; 
    recognition.interimResults = false;

    // 2. toggleMic Function (Handles Start/Stop)
    const toggleMic = (e) => {
        e.preventDefault(); // Stop double-firing events
        e.stopPropagation();

        // Security Check for Mobile
        if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
            alert("Microphone only works over HTTPS on mobile devices. Please deploy to a secure server (like Render).");
            return;
        }

        if (micBtn.classList.contains("listening")) {
            recognition.stop();
        } else {
            // Add a small delay for touch feedback
            micBtn.classList.add("listening"); 
            recognition.start();
        }
    };

    // 3. Add BOTH Click and Touch Listeners for Mobile Responsiveness
    micBtn.addEventListener("click", toggleMic);
    micBtn.addEventListener("touchend", toggleMic);
    
    // 4. Speech Recognition Event Handlers
    recognition.onstart = () => {
        micBtn.classList.add("listening");
        promptInput.placeholder = "Listening...";
    };

    recognition.onend = () => {
        micBtn.classList.remove("listening");
        promptInput.placeholder = "Enter a prompt here";
    };

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        promptInput.value = transcript;
        updateSendBtnState(); // Ensure the send button lights up
    };

    // Error Handling
    recognition.onerror = (event) => {
        console.error("Speech recognition error", event.error);
        micBtn.classList.remove("listening");
        promptInput.placeholder = "Error. Try again.";
    };

} else {
    micBtn.style.display = "none";
    console.log("Web Speech API not supported in this browser.");
}

// --- Mobile-Friendly Text-to-Speech ---
window.speakText = (btn) => {
    
    const messageDiv = btn.closest('.message-content');
    if (!messageDiv) return;

    let text = messageDiv.innerText.replace('content_copy Copy', '').trim();
 
    window.speechSynthesis.cancel();

    document.querySelectorAll('.speak-btn span').forEach(icon => {
        icon.innerText = 'volume_up';
    });

    if (btn.classList.contains('speaking')) {
        btn.classList.remove('speaking');
        return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 1; 
    utterance.pitch = 1;

    const iconSpan = btn.querySelector('span');
    iconSpan.innerText = 'stop_circle';
    btn.classList.add('speaking');

    utterance.onend = () => {
        iconSpan.innerText = 'volume_up';
        btn.classList.remove('speaking');
    };

    utterance.onerror = () => {
        iconSpan.innerText = 'volume_up';
        btn.classList.remove('speaking');
    };

    window.speechSynthesis.speak(utterance);
};