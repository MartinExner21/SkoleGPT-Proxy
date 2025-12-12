// =============================
// SkoleGPT Læsehjælp – contentScript.js
// =============================

console.log("[SkoleGPT] contentScript indlæst");

// ==========================================================
// 🔊 ElevenLabs TTS – DIN API KEY OG VOICE ID
// ==========================================================

const ELEVENLABS_API_KEY =
  "sk_8f995a49746afc2fd6662e8b10168b934d202b5fa63c44ca";
const ELEVENLABS_VOICE_ID = "4RklGmuxoAskAbGXplXN";
const ELEVENLABS_TTS_URL = `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`;

// =============================

let micButton = null;
let recognition = null;
let recognizing = false;

let fullPageText = "";

let panel = null;
let panelHeader = null;
let panelTitle = null;
let panelContent = null;
let minimizeButton = null;

let minimizedIcon = null; // NEW — lille + ikon
let panelMinimized = false;

// =============================
// Udtræk hele sidens tekst
// =============================

function extractPageText() {
  try {
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT
    );

    let text = "";
    let node;
    while ((node = walker.nextNode())) {
      const parent = node.parentElement;
      if (!parent) continue;
      const style = window.getComputedStyle(parent);
      if (style.display === "none" || style.visibility === "hidden") continue;
      text += " " + node.nodeValue;
    }

    fullPageText = text.trim().replace(/\s+/g, " ");
  } catch {
    fullPageText = "";
  }
}

extractPageText();

// =============================
// 🔊 ElevenLabs TTS
// =============================

async function speakText(text) {
  if (!text || !text.trim()) return;

  try {
    const res = await fetch(ELEVENLABS_TTS_URL, {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
        Accept: "audio/mpeg"
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: { stability: 0.4, similarity_boost: 0.9 }
      })
    });

    if (!res.ok) return console.error("ElevenLabs TTS error:", await res.text());

    const arrayBuffer = await res.arrayBuffer();
    const blob = new Blob([arrayBuffer], { type: "audio/mpeg" });
    const url = URL.createObjectURL(blob);

    const audio = new Audio(url);
    audio.onended = () => URL.revokeObjectURL(url);
    audio.play();
  } catch (e) {
    console.error("ElevenLabs fejl:", e);
  }
}

// =============================
// UI: Panel + Minimér + Nyt plus-ikon
// =============================

function createPanel() {
  if (panel) return;

  // PANEL
  panel = document.createElement("div");
  panel.style.position = "fixed";
  panel.style.bottom = "60px";
  panel.style.left = "16px";
  panel.style.width = "300px";
  panel.style.maxHeight = "45vh";
  panel.style.background = "#ffffff";
  panel.style.border = "2px solid #1f2937";
  panel.style.borderRadius = "12px";
  panel.style.padding = "8px 10px";
  panel.style.fontFamily = "system-ui, sans-serif";
  panel.style.fontSize = "14px";
  panel.style.zIndex = 2147483647;
  panel.style.boxShadow = "0 4px 12px rgba(0,0,0,0.25)";
  panel.style.display = "flex";
  panel.style.flexDirection = "column";
  panel.style.rowGap = "6px";

  // Header
  panelHeader = document.createElement("div");
  panelHeader.style.display = "flex";
  panelHeader.style.justifyContent = "space-between";
  panelHeader.style.alignItems = "center";

  panelTitle = document.createElement("span");
  panelTitle.innerText = "SkoleGPT";
  panelTitle.style.fontWeight = "600";

  minimizeButton = document.createElement("button");
  minimizeButton.innerText = "–";
  minimizeButton.style.border = "none";
  minimizeButton.style.borderRadius = "999px";
  minimizeButton.style.width = "24px";
  minimizeButton.style.height = "24px";
  minimizeButton.style.cursor = "pointer";
  minimizeButton.style.background = "#e5e7eb";

  minimizeButton.addEventListener("click", minimizePanel);

  panelHeader.appendChild(panelTitle);
  panelHeader.appendChild(minimizeButton);
  panel.appendChild(panelHeader);

  // Chat-indhold
  panelContent = document.createElement("div");
  panelContent.style.overflowY = "auto";
  panelContent.style.maxHeight = "34vh";

  panel.appendChild(panelContent);

  document.body.appendChild(panel);

  // LILLE PLUS-IKON – skjult fra start
  minimizedIcon = document.createElement("button");
  minimizedIcon.innerText = "+";
  minimizedIcon.style.position = "fixed";
  minimizedIcon.style.bottom = "60px";
  minimizedIcon.style.left = "16px";
  minimizedIcon.style.width = "40px";
  minimizedIcon.style.height = "40px";
  minimizedIcon.style.borderRadius = "999px";
  minimizedIcon.style.border = "2px solid #1f2937";
  minimizedIcon.style.background = "#ffffff";
  minimizedIcon.style.fontSize = "22px";
  minimizedIcon.style.fontWeight = "bold";
  minimizedIcon.style.cursor = "pointer";
  minimizedIcon.style.zIndex = 2147483647;
  minimizedIcon.style.boxShadow = "0 4px 10px rgba(0,0,0,0.2)";
  minimizedIcon.style.display = "none";

  minimizedIcon.addEventListener("click", restorePanel);

  document.body.appendChild(minimizedIcon);
}

function minimizePanel() {
  panel.style.display = "none";
  minimizedIcon.style.display = "flex";
  minimizedIcon.style.alignItems = "center";
  minimizedIcon.style.justifyContent = "center";
  panelMinimized = true;
}

function restorePanel() {
  minimizedIcon.style.display = "none";
  panel.style.display = "flex";
  panelMinimized = false;
}

// =============================
// Tilføj bruger og assistent-tekst i panelet
// =============================

function addToPanel(role, text) {
  createPanel();

  const entry = document.createElement("div");
  entry.style.marginBottom = "8px";
  entry.style.padding = "8px 10px";
  entry.style.borderRadius = "6px";
  entry.style.whiteSpace = "pre-wrap";

  if (role === "user") {
    entry.style.background = "#e0f2fe";
    entry.innerHTML = `<strong>Du:</strong><br>${text}`;
  } else {
    entry.style.background = "#fef9c3";
    entry.innerHTML = `<strong>SkoleGPT:</strong><br>${text}`;
  }

  panelContent.appendChild(entry);
  panelContent.scrollTop = panelContent.scrollHeight;
}

// =============================
// Mikrofon-knap
// =============================

function ensureMicButton() {
  if (micButton) return;

  micButton = document.createElement("button");
  micButton.textContent = "🎤 Spørg SkoleGPT";
  micButton.style.position = "fixed";
  micButton.style.bottom = "16px";
  micButton.style.left = "16px";
  micButton.style.zIndex = 2147483647;
  micButton.style.background = "#2563eb";
  micButton.style.color = "#fff";
  micButton.style.border = "none";
  micButton.style.padding = "10px 16px";
  micButton.style.borderRadius = "999px";
  micButton.style.cursor = "pointer";
  micButton.style.boxShadow = "0 4px 10px rgba(0,0,0,0.25)";

  micButton.addEventListener("click", toggleMic);
  document.body.appendChild(micButton);
}

ensureMicButton();

// =============================
// Talegenkendelse
// =============================

function setupRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return alert("Browser mangler talegenkendelse");

  const rec = new SR();
  rec.lang = "da-DK";
  rec.interimResults = false;

  rec.onstart = () => {
    recognizing = true;
    micButton.textContent = "🎙 Lytter…";
    micButton.style.background = "#dc2626";
  };

  rec.onend = () => {
    recognizing = false;
    micButton.textContent = "🎤 Spørg SkoleGPT";
    micButton.style.background = "#2563eb";
  };

  rec.onresult = (event) => {
    const transcript = event.results?.[0]?.[0]?.transcript || "";
    if (transcript.trim()) {
      addToPanel("user", transcript);
      sendVoiceQuery(transcript);
    }
  };

  return rec;
}

function toggleMic() {
  if (recognizing && recognition) {
    recognition.stop();
    return;
  }

  if (!recognition) recognition = setupRecognition();
  if (!recognition) return;

  recognition.start();
}

// =============================
// Send voice request til background.js
// =============================

function getSelectionText() {
  return window.getSelection()?.toString() || "";
}

function sendVoiceQuery(question) {
  chrome.runtime.sendMessage({
    type: "SKOLEGPT_VOICE_QUERY",
    question,
    selectedText: getSelectionText(),
    fullPageText
  });
}

// =============================
// Modtag svar fra background
// =============================

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "SKOLEGPT_ANSWER") {
    addToPanel("assistant", msg.text);
    speakText(msg.text);
  }

  if (msg.type === "SKOLEGPT_ERROR") {
    addToPanel("assistant", "FEJL: " + msg.message);
  }
});

