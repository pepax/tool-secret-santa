"use strict";

/**
 * Secret Santa app (in-memory only)
 * - participants: string[]
 * - assignments: Map<giver, receiver>
 * - revealed: Set<giver>
 * - currentIndex: number
 * - revealState: "ready" | "confirm" | "revealed"
 */
const state = {
  participants: [],
  assignments: new Map(),
  revealed: new Set(),
  currentIndex: 0,
  revealState: "ready",
};

const ui = {
  screens: {
    setup: document.getElementById("setup-screen"),
    reveal: document.getElementById("reveal-screen"),
    finished: document.getElementById("finished-screen"),
  },
  form: document.getElementById("add-form"),
  nameInput: document.getElementById("name-input"),
  addBtn: document.getElementById("add-btn"),
  list: document.getElementById("participant-list"),
  setupMessage: document.getElementById("setup-message"),
  startBtn: document.getElementById("start-btn"),
  turnIndicator: document.getElementById("turn-indicator"),
  readyStep: document.getElementById("ready-step"),
  confirmStep: document.getElementById("confirm-step"),
  resultStep: document.getElementById("result-step"),
  revealBtn: document.getElementById("reveal-btn"),
  confirmRevealBtn: document.getElementById("confirm-reveal-btn"),
  cancelRevealBtn: document.getElementById("cancel-reveal-btn"),
  assignedName: document.getElementById("assigned-name"),
  nextBtn: document.getElementById("next-btn"),
  resetBtn: document.getElementById("reset-btn"),
};

function init() {
  bindEvents();
  renderSetup();
  showScreen("setup");
}

function bindEvents() {
  ui.form.addEventListener("submit", (event) => {
    event.preventDefault();
    addParticipant(ui.nameInput.value);
  });

  ui.list.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-remove]");
    if (!button) return;
    removeParticipant(button.dataset.remove);
  });

  ui.startBtn.addEventListener("click", startSecretSanta);

  ui.revealBtn.addEventListener("click", () => {
    state.revealState = "confirm";
    renderReveal();
  });

  ui.cancelRevealBtn.addEventListener("click", () => {
    state.revealState = "ready";
    renderReveal();
  });

  ui.confirmRevealBtn.addEventListener("click", revealAssignment);
  ui.nextBtn.addEventListener("click", hideAndAdvance);
  ui.resetBtn.addEventListener("click", resetAll);
}

/* ----------------------------- Setup Phase ----------------------------- */

function addParticipant(rawName) {
  const name = normalizeName(rawName);

  if (!name) {
    setSetupMessage("Please enter a name.", true);
    return;
  }

  if (hasDuplicateName(name)) {
    setSetupMessage("That name is already in the list.", true);
    return;
  }

  state.participants.push(name);
  ui.nameInput.value = "";
  setSetupMessage("Name added.");
  renderSetup();
  ui.nameInput.focus();
}

function removeParticipant(name) {
  state.participants = state.participants.filter((n) => n !== name);
  setSetupMessage("Name removed.");
  renderSetup();
}

function renderSetup() {
  ui.list.innerHTML = "";

  if (state.participants.length === 0) {
    const empty = document.createElement("li");
    empty.className = "participant-item";
    empty.innerHTML = `<span class="participant-name">No participants yet.</span>`;
    ui.list.appendChild(empty);
  } else {
    const fragment = document.createDocumentFragment();

    state.participants.forEach((name) => {
      const item = document.createElement("li");
      item.className = "participant-item";
      item.innerHTML = `
        <span class="participant-name">${escapeHtml(name)}</span>
        <button class="btn btn-ghost" type="button" data-remove="${escapeHtmlAttr(name)}" aria-label="Remove ${escapeHtmlAttr(name)}">
          Remove
        </button>
      `;
      fragment.appendChild(item);
    });

    ui.list.appendChild(fragment);
  }

  ui.startBtn.disabled = state.participants.length < 2;
}

/* -------------------------- Assignment Logic --------------------------- */
/**
 * Sattolo's algorithm:
 * Produces a single-cycle permutation (a valid derangement for n >= 2).
 * This avoids naive "shuffle-until-valid" retries.
 */
function buildDerangement(names) {
  if (names.length < 2) {
    throw new Error("Need at least 2 participants.");
  }

  const receivers = [...names];

  for (let i = receivers.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * i); // 0..i-1
    [receivers[i], receivers[j]] = [receivers[j], receivers[i]];
  }

  const assignments = new Map();
  names.forEach((giver, index) => {
    assignments.set(giver, receivers[index]);
  });

  if (!isValidAssignment(names, assignments)) {
    throw new Error("Invalid assignment generated.");
  }

  return assignments;
}

function isValidAssignment(names, assignments) {
  if (assignments.size !== names.length) return false;

  const assignedSet = new Set(assignments.values());
  if (assignedSet.size !== names.length) return false;

  for (const name of names) {
    if (!assignments.has(name)) return false;
    if (assignments.get(name) === name) return false;
  }

  return true;
}

/* ---------------------------- Reveal Phase ----------------------------- */

function startSecretSanta() {
  if (state.participants.length < 2) {
    setSetupMessage("Add at least 2 participants to start.", true);
    return;
  }

  try {
    state.assignments = buildDerangement(state.participants);
  } catch {
    setSetupMessage("Could not generate assignments. Please try again.", true);
    return;
  }

  state.revealed = new Set();
  state.currentIndex = 0;
  state.revealState = "ready";
  ui.assignedName.textContent = "";

  renderReveal();
  showScreen("reveal");
}

function renderReveal() {
  if (state.currentIndex >= state.participants.length) {
    showScreen("finished");
    return;
  }

  const turn = state.currentIndex + 1;
  const total = state.participants.length;
  ui.turnIndicator.textContent = `Person ${turn} of ${total}`;

  ui.readyStep.classList.toggle("hidden", state.revealState !== "ready");
  ui.confirmStep.classList.toggle("hidden", state.revealState !== "confirm");
  ui.resultStep.classList.toggle("hidden", state.revealState !== "revealed");
}

function revealAssignment() {
  const giver = state.participants[state.currentIndex];
  if (!giver || state.revealed.has(giver)) return;

  state.revealState = "revealed";
  renderReveal();

  ui.assignedName.textContent = "Revealing…";
  ui.confirmRevealBtn.disabled = true;

  window.setTimeout(() => {
    const receiver = state.assignments.get(giver);
    ui.assignedName.textContent = receiver || "Unknown";
    ui.confirmRevealBtn.disabled = false;
  }, 700);
}

function hideAndAdvance() {
  const giver = state.participants[state.currentIndex];
  if (!giver) return;

  state.revealed.add(giver);
  ui.assignedName.textContent = "";
  state.currentIndex += 1;
  state.revealState = "ready";

  if (state.currentIndex >= state.participants.length) {
    showScreen("finished");
    return;
  }

  renderReveal();
}

/* ------------------------------- Reset -------------------------------- */

function resetAll() {
  state.participants = [];
  state.assignments = new Map();
  state.revealed = new Set();
  state.currentIndex = 0;
  state.revealState = "ready";

  ui.nameInput.value = "";
  ui.assignedName.textContent = "";
  setSetupMessage("");
  renderSetup();
  showScreen("setup");
}

/* ------------------------------ Helpers ------------------------------- */

function showScreen(screenName) {
  ui.screens.setup.classList.toggle("hidden", screenName !== "setup");
  ui.screens.reveal.classList.toggle("hidden", screenName !== "reveal");
  ui.screens.finished.classList.toggle("hidden", screenName !== "finished");
}

function setSetupMessage(message, isError = false) {
  ui.setupMessage.textContent = message;
  ui.setupMessage.classList.toggle("error", isError);
}

function normalizeName(value) {
  return value.trim().replace(/\s+/g, " ");
}

function hasDuplicateName(name) {
  const lowered = name.toLocaleLowerCase();
  return state.participants.some((existing) => existing.toLocaleLowerCase() === lowered);
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeHtmlAttr(value) {
  return escapeHtml(value);
}

document.addEventListener("DOMContentLoaded", init);
