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

const STORAGE_KEY = "secret-santa-store";
const STORE_VERSION = 1;
const DEFAULT_GROUP_ID = "default";

let store = getDefaultStore();

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
  passText: document.getElementById("pass-text"),
  readyStep: document.getElementById("ready-step"),
  confirmStep: document.getElementById("confirm-step"),
  resultStep: document.getElementById("result-step"),
  revealBtn: document.getElementById("reveal-btn"),
  confirmRevealBtn: document.getElementById("confirm-reveal-btn"),
  cancelRevealBtn: document.getElementById("cancel-reveal-btn"),
  assignedName: document.getElementById("assigned-name"),
  nextBtn: document.getElementById("next-btn"),
  runAgainBtn: document.getElementById("run-again-btn"),
  editParticipantsBtn: document.getElementById("edit-participants-btn"),
  resetBtn: document.getElementById("reset-btn"),
};

function init() {
  const loadResult = loadStore();
  state.participants = [...getActiveGroupParticipants()];
  bindEvents();
  renderSetup();
  showScreen("setup");

  if (loadResult.warningMessage) {
    setSetupMessage(loadResult.warningMessage, true);
  }
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
  ui.runAgainBtn.addEventListener("click", runAgainWithSameParticipants);
  ui.editParticipantsBtn.addEventListener("click", editParticipants);
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
  setActiveGroupParticipants(state.participants);
  saveStore();
  ui.nameInput.value = "";
  setSetupMessage("Name added.");
  renderSetup();
  ui.nameInput.focus();
}

function removeParticipant(name) {
  state.participants = state.participants.filter((n) => n !== name);
  setActiveGroupParticipants(state.participants);
  saveStore();
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

  resetRunState();

  try {
    state.assignments = buildDerangement(state.participants);
  } catch {
    setSetupMessage("Could not generate assignments. Please try again.", true);
    return;
  }

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
  const currentParticipant = state.participants[state.currentIndex];
  const isRevealed = state.revealState === "revealed";
  const hasNextParticipant = state.currentIndex < total - 1;
  ui.turnIndicator.textContent = `It's ${currentParticipant}'s turn (${turn} of ${total})`;

  ui.readyStep.classList.toggle("hidden", state.revealState !== "ready");
  ui.confirmStep.classList.toggle("hidden", state.revealState !== "confirm");
  ui.resultStep.classList.toggle("hidden", !isRevealed);
  ui.passText.classList.toggle("hidden", isRevealed);
  ui.nextBtn.textContent = hasNextParticipant ? "Hide and pass to next person" : "Finish";
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

function resetRunState() {
  state.assignments = new Map();
  state.revealed = new Set();
  state.currentIndex = 0;
  state.revealState = "ready";
  ui.assignedName.textContent = "";
  ui.turnIndicator.textContent = "";
  ui.passText.classList.remove("hidden");
}

function runAgainWithSameParticipants() {
  resetRunState();
  startSecretSanta();
}

function editParticipants() {
  resetRunState();
  setSetupMessage("");
  renderSetup();
  showScreen("setup");
}

function resetAll() {
  state.participants = [];
  setActiveGroupParticipants(state.participants);
  saveStore();
  resetRunState();

  ui.nameInput.value = "";
  setSetupMessage("");
  renderSetup();
  showScreen("setup");
}

/* ------------------------------ Helpers ------------------------------- */

function getDefaultStore() {
  return {
    version: STORE_VERSION,
    groups: {
      [DEFAULT_GROUP_ID]: {
        id: DEFAULT_GROUP_ID,
        name: "Default Group",
        participants: [],
      },
    },
    activeGroupId: DEFAULT_GROUP_ID,
  };
}

function migrateStore(rawStore) {
  const fallbackStore = getDefaultStore();

  if (!rawStore || typeof rawStore !== "object") {
    return fallbackStore;
  }

  const incomingVersion = Number(rawStore.version);
  const rawGroups = rawStore.groups;
  const groups = {};

  if (rawGroups && typeof rawGroups === "object" && !Array.isArray(rawGroups)) {
    Object.entries(rawGroups).forEach(([groupId, groupData]) => {
      if (!groupData || typeof groupData !== "object") return;

      const participants = Array.isArray(groupData.participants)
        ? groupData.participants
            .map((value) => (typeof value === "string" ? normalizeName(value) : ""))
            .filter(Boolean)
        : [];

      groups[groupId] = {
        id: typeof groupData.id === "string" && groupData.id ? groupData.id : groupId,
        name:
          typeof groupData.name === "string" && groupData.name
            ? groupData.name
            : "Group",
        participants,
      };
    });
  }

  if (Object.keys(groups).length === 0 && Array.isArray(rawStore.participants)) {
    groups[DEFAULT_GROUP_ID] = {
      ...fallbackStore.groups[DEFAULT_GROUP_ID],
      participants: rawStore.participants
        .map((value) => (typeof value === "string" ? normalizeName(value) : ""))
        .filter(Boolean),
    };
  }

  if (Object.keys(groups).length === 0) {
    groups[DEFAULT_GROUP_ID] = { ...fallbackStore.groups[DEFAULT_GROUP_ID] };
  }

  const activeGroupId =
    typeof rawStore.activeGroupId === "string" && groups[rawStore.activeGroupId]
      ? rawStore.activeGroupId
      : Object.keys(groups)[0];

  return {
    version: Number.isFinite(incomingVersion) ? incomingVersion : STORE_VERSION,
    groups,
    activeGroupId,
  };
}

function loadStore() {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    store = getDefaultStore();
    return { warningMessage: "" };
  }

  try {
    const parsed = JSON.parse(raw);
    store = migrateStore(parsed);
    store.version = STORE_VERSION;
    saveStore();
    return { warningMessage: "" };
  } catch {
    store = getDefaultStore();
    saveStore();
    return {
      warningMessage:
        "Saved data was corrupted and has been reset to a clean default.",
    };
  }
}

function saveStore() {
  const persisted = {
    version: STORE_VERSION,
    groups: store.groups,
    activeGroupId: store.activeGroupId,
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
}

function getActiveGroupParticipants() {
  const activeGroup = store.groups[store.activeGroupId];
  return Array.isArray(activeGroup?.participants) ? activeGroup.participants : [];
}

function setActiveGroupParticipants(participants) {
  if (!store.groups[store.activeGroupId]) {
    store.groups[store.activeGroupId] = {
      id: store.activeGroupId,
      name: "Group",
      participants: [],
    };
  }

  store.groups[store.activeGroupId].participants = [...participants];
}

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
