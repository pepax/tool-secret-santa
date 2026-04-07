"use strict";

const state = {
  runParticipants: [],
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
  groupSelect: document.getElementById("group-select"),
  newGroupBtn: document.getElementById("new-group-btn"),
  renameGroupBtn: document.getElementById("rename-group-btn"),
  deleteGroupBtn: document.getElementById("delete-group-btn"),
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
  ui.groupSelect.addEventListener("change", (event) => {
    setActiveGroup(event.target.value);
  });
  ui.newGroupBtn.addEventListener("click", createNewGroup);
  ui.renameGroupBtn.addEventListener("click", renameActiveGroup);
  ui.deleteGroupBtn.addEventListener("click", deleteActiveGroup);

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
  const participants = getActiveGroupParticipants();
  const name = normalizeName(rawName);

  if (!name) {
    setSetupMessage("Please enter a name.", true);
    return;
  }

  if (hasDuplicateName(name, participants)) {
    setSetupMessage("That name is already in the list.", true);
    return;
  }

  setActiveGroupParticipants([...participants, name]);
  saveStore();
  ui.nameInput.value = "";
  setSetupMessage("Name added.");
  renderSetup();
  ui.nameInput.focus();
}

function removeParticipant(name) {
  const participants = getActiveGroupParticipants().filter((n) => n !== name);
  setActiveGroupParticipants(participants);
  saveStore();
  setSetupMessage("Name removed.");
  renderSetup();
}

function renderSetup() {
  const activeGroup = getActiveGroup();
  const participants = activeGroup.participants;

  renderGroupControls();
  ui.list.innerHTML = "";

  if (participants.length === 0) {
    const empty = document.createElement("li");
    empty.className = "participant-item";
    empty.innerHTML = `<span class="participant-name">No participants yet.</span>`;
    ui.list.appendChild(empty);
  } else {
    const fragment = document.createDocumentFragment();

    participants.forEach((name) => {
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

  ui.startBtn.disabled = participants.length < 2;
  ui.startBtn.title =
    participants.length < 2
      ? `Add at least 2 participants to "${activeGroup.name}" to start.`
      : "";
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
  const participants = getActiveGroupParticipants();

  if (participants.length < 2) {
    setSetupMessage("Add at least 2 participants to start.", true);
    return;
  }

  resetRunState();
  state.runParticipants = [...participants];

  try {
    state.assignments = buildDerangement(state.runParticipants);
  } catch {
    setSetupMessage("Could not generate assignments. Please try again.", true);
    return;
  }

  renderReveal();
  showScreen("reveal");
}

function renderReveal() {
  if (state.currentIndex >= state.runParticipants.length) {
    showScreen("finished");
    return;
  }

  const turn = state.currentIndex + 1;
  const total = state.runParticipants.length;
  const currentParticipant = state.runParticipants[state.currentIndex];
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
  const giver = state.runParticipants[state.currentIndex];
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
  const giver = state.runParticipants[state.currentIndex];
  if (!giver) return;

  state.revealed.add(giver);
  ui.assignedName.textContent = "";
  state.currentIndex += 1;
  state.revealState = "ready";

  if (state.currentIndex >= state.runParticipants.length) {
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
  if (state.runParticipants.length < 2) {
    editParticipants();
    return;
  }

  resetRunState();

  try {
    state.assignments = buildDerangement(state.runParticipants);
  } catch {
    setSetupMessage("Could not generate assignments. Please try again.", true);
    showScreen("setup");
    return;
  }

  renderReveal();
  showScreen("reveal");
}

function editParticipants() {
  resetRunState();
  setSetupMessage("");
  renderSetup();
  showScreen("setup");
}

function resetAll() {
  const groups = Object.values(store.groupsById || {});
  const totalGroups = groups.length;
  const totalParticipants = groups.reduce(
    (sum, group) => sum + (Array.isArray(group.participants) ? group.participants.length : 0),
    0,
  );

  const consequenceMessage = `This permanently deletes ${totalGroups} group${totalGroups === 1 ? "" : "s"} and ${totalParticipants} participant${totalParticipants === 1 ? "" : "s"}.`;
  const confirmed = window.confirm(
    `Delete all groups and participants?\n\n${consequenceMessage}`,
  );
  if (!confirmed) return;

  if (totalParticipants > 0) {
    const token = window.prompt(
      `High-impact action.\n\n${consequenceMessage}\n\nType DELETE to confirm.`,
      "",
    );
    if (token?.trim() !== "DELETE") return;
  }

  store = getDefaultStore();
  saveStore();
  resetRunState();

  ui.nameInput.value = "";
  setSetupMessage("All data cleared.");
  renderSetup();
  showScreen("setup");
}

/* ------------------------------ Helpers ------------------------------- */

function getDefaultStore() {
  return {
    version: STORE_VERSION,
    groupsById: {
      [DEFAULT_GROUP_ID]: { id: DEFAULT_GROUP_ID, name: "Default Group", participants: [] },
    },
    groupOrder: [DEFAULT_GROUP_ID],
    activeGroupId: DEFAULT_GROUP_ID,
  };
}

function migrateStore(rawStore) {
  const fallbackStore = getDefaultStore();

  if (!rawStore || typeof rawStore !== "object") {
    return fallbackStore;
  }

  const incomingVersion = Number(rawStore.version);
  const rawGroupsById =
    rawStore.groupsById && typeof rawStore.groupsById === "object" && !Array.isArray(rawStore.groupsById)
      ? rawStore.groupsById
      : rawStore.groups && typeof rawStore.groups === "object" && !Array.isArray(rawStore.groups)
        ? rawStore.groups
        : null;
  const groupsById = {};

  if (rawGroupsById) {
    Object.entries(rawGroupsById).forEach(([groupId, groupData]) => {
      if (!groupData || typeof groupData !== "object") return;

      const participants = Array.isArray(groupData.participants)
        ? groupData.participants
            .map((value) => (typeof value === "string" ? normalizeName(value) : ""))
            .filter(Boolean)
        : [];

      groupsById[groupId] = {
        id: typeof groupData.id === "string" && groupData.id ? groupData.id : groupId,
        name: typeof groupData.name === "string" && groupData.name ? groupData.name : "Group",
        participants,
      };
    });
  }

  if (Object.keys(groupsById).length === 0 && Array.isArray(rawStore.participants)) {
    groupsById[DEFAULT_GROUP_ID] = {
      ...fallbackStore.groupsById[DEFAULT_GROUP_ID],
      participants: rawStore.participants
        .map((value) => (typeof value === "string" ? normalizeName(value) : ""))
        .filter(Boolean),
    };
  }

  if (Object.keys(groupsById).length === 0) {
    groupsById[DEFAULT_GROUP_ID] = { ...fallbackStore.groupsById[DEFAULT_GROUP_ID] };
  }

  const validIds = new Set(Object.keys(groupsById));
  const groupOrderSource = Array.isArray(rawStore.groupOrder) ? rawStore.groupOrder : [];
  const groupOrder = groupOrderSource.filter(
    (groupId, index) =>
      typeof groupId === "string" && validIds.has(groupId) && groupOrderSource.indexOf(groupId) === index,
  );

  Object.keys(groupsById).forEach((groupId) => {
    if (!groupOrder.includes(groupId)) {
      groupOrder.push(groupId);
    }
  });

  const activeGroupId =
    typeof rawStore.activeGroupId === "string" && groupsById[rawStore.activeGroupId]
      ? rawStore.activeGroupId
      : groupOrder[0];

  return {
    version: Number.isFinite(incomingVersion) ? incomingVersion : STORE_VERSION,
    groupsById,
    groupOrder,
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
    groupsById: store.groupsById,
    groupOrder: store.groupOrder,
    activeGroupId: store.activeGroupId,
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
}

function getActiveGroup() {
  if (!store.groupsById[store.activeGroupId]) {
    const fallbackId = store.groupOrder[0];
    store.activeGroupId = fallbackId || DEFAULT_GROUP_ID;
  }

  if (!store.groupsById[store.activeGroupId]) {
    store.groupsById[store.activeGroupId] = {
      id: store.activeGroupId,
      name: "Group",
      participants: [],
    };
    if (!store.groupOrder.includes(store.activeGroupId)) {
      store.groupOrder.push(store.activeGroupId);
    }
  }

  return store.groupsById[store.activeGroupId];
}

function getActiveGroupParticipants() {
  const activeGroup = getActiveGroup();
  return Array.isArray(activeGroup.participants) ? [...activeGroup.participants] : [];
}

function setActiveGroupParticipants(participants) {
  const activeGroup = getActiveGroup();
  activeGroup.participants = [...participants];
}

function setActiveGroup(groupId) {
  if (!store.groupsById[groupId]) return;
  store.activeGroupId = groupId;
  saveStore();
  setSetupMessage("");
  renderSetup();
}

function renderGroupControls() {
  ui.groupSelect.innerHTML = "";

  const fragment = document.createDocumentFragment();
  store.groupOrder.forEach((groupId) => {
    const group = store.groupsById[groupId];
    if (!group) return;

    const option = document.createElement("option");
    option.value = group.id;
    option.textContent = group.name;
    fragment.appendChild(option);
  });

  ui.groupSelect.appendChild(fragment);
  ui.groupSelect.value = store.activeGroupId;
  ui.deleteGroupBtn.disabled = store.groupOrder.length <= 1;
}

function createNewGroup() {
  const rawName = window.prompt("Name for the new group:");
  const name = rawName ? rawName.trim() : "";
  if (!name) return;

  const id = `group-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  store.groupsById[id] = { id, name, participants: [] };
  store.groupOrder.push(id);
  store.activeGroupId = id;
  saveStore();
  setSetupMessage(`Created group "${name}".`);
  renderSetup();
  ui.nameInput.focus();
}

function renameActiveGroup() {
  const activeGroup = getActiveGroup();
  const rawName = window.prompt("Rename group:", activeGroup.name);
  const name = rawName ? rawName.trim() : "";
  if (!name) return;

  activeGroup.name = name;
  saveStore();
  setSetupMessage(`Renamed group to "${name}".`);
  renderSetup();
}

function deleteActiveGroup() {
  const activeGroup = getActiveGroup();
  const hasParticipants = activeGroup.participants.length > 0;

  if (hasParticipants) {
    const confirmed = window.confirm(
      `Delete "${activeGroup.name}" and its ${activeGroup.participants.length} participant(s)?`,
    );
    if (!confirmed) return;
  }

  if (store.groupOrder.length <= 1) {
    setSetupMessage("You must keep at least one group.", true);
    return;
  }

  delete store.groupsById[activeGroup.id];
  store.groupOrder = store.groupOrder.filter((groupId) => groupId !== activeGroup.id);
  store.activeGroupId = store.groupOrder[0];
  saveStore();
  setSetupMessage(`Deleted group "${activeGroup.name}".`);
  renderSetup();
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

function hasDuplicateName(name, participants) {
  const lowered = name.toLocaleLowerCase();
  return participants.some((existing) => existing.toLocaleLowerCase() === lowered);
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
