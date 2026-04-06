const STORAGE_KEY = "tool-template-state-v1";

const state = {
  input: {
    mainInput: "",
    optionInput: "",
  },
  output: "",
};

const ui = {
  form: null,
  mainInput: null,
  optionInput: null,
  resultOutput: null,
  calculateBtn: null,
  copyBtn: null,
  resetBtn: null,
  statusMessage: null,
};

function init() {
  cacheElements();
  createStatusMessage();
  restoreState();
  bindEvents();
  renderInputs();
  renderOutput();
}

function cacheElements() {
  ui.form = document.getElementById("tool-form");
  ui.mainInput = document.getElementById("main-input");
  ui.optionInput = document.getElementById("option-input");
  ui.resultOutput = document.getElementById("result-output");
  ui.calculateBtn = document.getElementById("calculate-btn");
  ui.copyBtn = document.getElementById("copy-btn");
  ui.resetBtn = document.getElementById("reset-btn");
}

function createStatusMessage() {
  const message = document.createElement("p");
  message.className = "status-message";
  message.setAttribute("aria-live", "polite");
  ui.form.appendChild(message);
  ui.statusMessage = message;
}

function bindEvents() {
  ui.mainInput.addEventListener("input", (event) => {
    handleInputChange("mainInput", event.target.value);
  });

  ui.optionInput.addEventListener("input", (event) => {
    handleInputChange("optionInput", event.target.value);
  });

  ui.calculateBtn.addEventListener("click", () => {
    compute();
    renderOutput();
  });

  ui.copyBtn.addEventListener("click", copyToClipboard);

  ui.resetBtn.addEventListener("click", () => {
    reset();
    renderInputs();
    renderOutput();
  });
}

function handleInputChange(field, value) {
  state.input[field] = value;
  saveState();
}

function compute() {
  // Placeholder logic:
  // Replace this with your own calculation/conversion/generation logic.
  const main = state.input.mainInput.trim();
  const option = state.input.optionInput.trim();

  if (!main) {
    state.output = "Enter a value first.";
    setStatus("No input provided.", true);
    saveState();
    return;
  }

  state.output = option
    ? `Main: ${main} | Option: ${option}`
    : `Main: ${main}`;

  setStatus("Result updated.");
  saveState();
}

function renderInputs() {
  ui.mainInput.value = state.input.mainInput;
  ui.optionInput.value = state.input.optionInput;
}

function renderOutput() {
  ui.resultOutput.textContent = state.output || "Result will appear here.";
}

function reset() {
  state.input.mainInput = "";
  state.input.optionInput = "";
  state.output = "";
  localStorage.removeItem(STORAGE_KEY);
  setStatus("Inputs and output reset.");
}

async function copyToClipboard() {
  if (!state.output) {
    setStatus("Nothing to copy yet.", true);
    return;
  }

  try {
    await navigator.clipboard.writeText(state.output);
    setStatus("Result copied to clipboard.");
  } catch {
    setStatus("Clipboard not available in this browser.", true);
  }
}

function setStatus(message, isError = false) {
  ui.statusMessage.textContent = message;
  ui.statusMessage.classList.toggle("error", isError);
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function restoreState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return;
  }

  try {
    const parsed = JSON.parse(raw);
    state.input.mainInput = parsed?.input?.mainInput ?? "";
    state.input.optionInput = parsed?.input?.optionInput ?? "";
    state.output = parsed?.output ?? "";
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

document.addEventListener("DOMContentLoaded", init);
