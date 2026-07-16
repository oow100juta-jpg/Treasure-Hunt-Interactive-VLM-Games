const clueText = document.querySelector("#clueText");
const roundLabel = document.querySelector("#roundLabel");
const startCamera = document.querySelector("#startCamera");
const cameraContainer = document.querySelector("#cameraContainer");
const viewfinder = document.querySelector("#viewfinder");
const captureButton = document.querySelector("#captureButton");
const snapshotCanvas = document.querySelector("#snapshotCanvas");
const preview = document.querySelector("#preview");
const capturedActions = document.querySelector("#capturedActions");
const retakeButton = document.querySelector("#retakeButton");
const checkButton = document.querySelector("#checkButton");
const nextButton = document.querySelector("#nextButton");
const result = document.querySelector("#result");
const resultTitle = document.querySelector("#resultTitle");
const resultMessage = document.querySelector("#resultMessage");
const meterFill = document.querySelector("#meterFill");
const scoreText = document.querySelector("#scoreText");
const reasonText = document.querySelector("#reasonText");

let clues = [];
let currentIndex = 0;
let stream = null;
let capturedBlob = null;

init();

async function init() {
  try {
    const response = await fetch("/api/clues");
    if (!response.ok) throw new Error("Could not load clues.");

    clues = await response.json();
    if (!clues.length) throw new Error("No clues are configured.");

    showClue();
  } catch (error) {
    showError(error.message);
  }
}

function showClue() {
  const clue = clues[currentIndex];
  roundLabel.textContent =
    `CLUE ${currentIndex + 1} OF ${clues.length} · ${clue.difficulty.toUpperCase()}`;
  clueText.textContent = clue.clue;

  // Reset UI state
  preview.hidden = true;
  capturedActions.hidden = true;
  result.hidden = true;
  nextButton.hidden = true;
  checkButton.disabled = true;
  capturedBlob = null;

  // If camera is already running, show viewfinder; otherwise show "Open camera"
  if (stream) {
    cameraContainer.hidden = false;
    startCamera.hidden = true;
  } else {
    cameraContainer.hidden = true;
    startCamera.hidden = false;
  }
}

/* ---- Camera lifecycle ---- */

startCamera.addEventListener("click", openCamera);

async function openCamera() {
  try {
    // Prefer rear camera on mobile
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } },
      audio: false
    });
    viewfinder.srcObject = stream;
    cameraContainer.hidden = false;
    startCamera.hidden = true;
  } catch (err) {
    showError("Camera access denied. This game requires camera permission.");
  }
}

function stopCamera() {
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
    viewfinder.srcObject = null;
  }
}

/* ---- Capture ---- */

captureButton.addEventListener("click", () => {
  if (!stream) return;

  // Flash animation
  cameraContainer.classList.add("flash");
  setTimeout(() => cameraContainer.classList.remove("flash"), 300);

  // Draw current frame to canvas
  const vw = viewfinder.videoWidth;
  const vh = viewfinder.videoHeight;
  snapshotCanvas.width = vw;
  snapshotCanvas.height = vh;
  const ctx = snapshotCanvas.getContext("2d");
  ctx.drawImage(viewfinder, 0, 0, vw, vh);

  // Convert to blob for upload
  snapshotCanvas.toBlob(
    (blob) => {
      capturedBlob = blob;

      // Show preview
      preview.src = URL.createObjectURL(blob);
      preview.hidden = false;
      capturedActions.hidden = false;
      checkButton.disabled = false;

      // Pause viewfinder (keep stream alive for retake)
      cameraContainer.hidden = true;
    },
    "image/jpeg",
    0.85
  );
});

/* ---- Retake ---- */

retakeButton.addEventListener("click", () => {
  capturedBlob = null;
  preview.hidden = true;
  capturedActions.hidden = true;
  result.hidden = true;
  checkButton.disabled = true;

  if (stream) {
    cameraContainer.hidden = false;
  } else {
    openCamera();
  }
});

/* ---- Check ---- */

checkButton.addEventListener("click", async () => {
  const clue = clues[currentIndex];
  if (!capturedBlob || !clue) {
    showError("Capture a photo first.");
    return;
  }

  checkButton.disabled = true;
  checkButton.textContent = "VLM is judging...";

  try {
    const formData = new FormData();
    formData.append("image", capturedBlob, "capture.jpg");
    formData.append("clueId", clue.id);

    const response = await fetch("/api/check", {
      method: "POST",
      body: formData
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Request failed.");

    result.hidden = false;
    result.className = `result ${data.passed ? "success" : "retry"}`;
    resultTitle.textContent = data.passed ? "Treasure found!" : "Keep hunting";
    resultMessage.textContent = data.message;

    const percent = Math.round(data.confidence * 100);
    meterFill.style.width = `${percent}%`;
    scoreText.textContent =
      `Detected: ${data.object} · confidence ${percent}%`;
    reasonText.textContent = data.reason;

    nextButton.hidden = !data.passed;
  } catch (error) {
    showError(error.message);
  } finally {
    checkButton.disabled = false;
    checkButton.textContent = "Check my treasure";
  }
});

/* ---- Next clue ---- */

nextButton.addEventListener("click", () => {
  currentIndex = (currentIndex + 1) % clues.length;
  showClue();
});

/* ---- Helpers ---- */

function showError(message) {
  result.hidden = false;
  result.className = "result retry";
  resultTitle.textContent = "Could not check";
  resultMessage.textContent = message;
  meterFill.style.width = "0%";
  scoreText.textContent = "";
  reasonText.textContent = "";
}
