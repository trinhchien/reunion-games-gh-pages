// ─── Auth & API ──────────────────────────────────────────────────────────────
const ADMIN_SESSION_KEY = "reunion-admin-jwt";

let state = { games: [], attendees: [] };
let activeAdminGameId = null;
let pendingGameSave = null;
let ws = null;

// ─── Token helpers ────────────────────────────────────────────────────────────
function getToken() {
  return sessionStorage.getItem(ADMIN_SESSION_KEY);
}

function setToken(token) {
  sessionStorage.setItem(ADMIN_SESSION_KEY, token);
}

function clearToken() {
  sessionStorage.removeItem(ADMIN_SESSION_KEY);
}

function isLoggedIn() {
  return Boolean(getToken());
}

// ─── API Helpers ──────────────────────────────────────────────────────────────
async function adminFetch(path, options = {}) {
  const token = getToken();
  const res = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });

  if (res.status === 401) {
    clearToken();
    setLoggedIn(false);
    showLoginMode();
    setAuthMessage("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
    throw new Error("Unauthorized");
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }

  return res.json();
}

async function fetchAdminState() {
  const [games, attendees] = await Promise.all([
    adminFetch("/api/admin/games"),
    adminFetch("/api/admin/attendees"),
  ]);
  state = { games, attendees };
  if (!activeAdminGameId || !state.games.some((g) => g.id === activeAdminGameId)) {
    activeAdminGameId = state.games[0]?.id ?? null;
  }
}

// ─── WebSocket ────────────────────────────────────────────────────────────────
function connectAdminWebSocket() {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  ws = new WebSocket(`${protocol}//${location.host}/ws`);

  ws.addEventListener("message", (event) => {
    try {
      const { event: evtName, data } = JSON.parse(event.data);
      if (evtName === "state_update") {
        // Only refresh if no pending local save (avoid overwriting in-progress edits)
        if (!pendingGameSave) {
          if (Array.isArray(data.games)) state.games = data.games;
          if (Array.isArray(data.attendees)) state.attendees = data.attendees;
          renderAdminApp();
        }
      }
    } catch {
      // Ignore malformed messages
    }
  });

  ws.addEventListener("close", () => {
    ws = null;
    setTimeout(connectAdminWebSocket, 3000);
  });
}

// ─── DOM refs ─────────────────────────────────────────────────────────────────
const authShell = document.getElementById("authShell");
const loginCard = document.getElementById("loginCard");
const authMessage = document.getElementById("authMessage");
const loginForm = document.getElementById("loginForm");
const loginUsernameInput = document.getElementById("loginUsernameInput");
const loginPasswordInput = document.getElementById("loginPasswordInput");
const adminApp = document.getElementById("adminApp");
const logoutBtn = document.getElementById("logoutBtn");
const summaryGames = document.getElementById("summaryGames");
const summaryAttendees = document.getElementById("summaryAttendees");
const summaryDuration = document.getElementById("summaryDuration");
const adminOverviewGames = document.getElementById("adminOverviewGames");
const adminGameTabs = document.getElementById("adminGameTabs");
const adminGamesList = document.getElementById("adminGamesList");
const attendeeList = document.getElementById("attendeeList");
const attendeeForm = document.getElementById("attendeeForm");
const attendeeNameInput = document.getElementById("attendeeNameInput");
const bulkImportInput = document.getElementById("bulkImportInput");
const importAttendeesBtn = document.getElementById("importAttendeesBtn");
const clearAttendeesBtn = document.getElementById("clearAttendeesBtn");
const attendeeCountLabel = document.getElementById("attendeeCountLabel");

// ─── Auth UI ──────────────────────────────────────────────────────────────────
function setAuthMessage(message, isError = false) {
  authMessage.textContent = message;
  authMessage.classList.toggle("is-error", isError);
  authMessage.classList.toggle("is-success", Boolean(message) && !isError);
}

function showLoginMode() {
  loginCard.classList.remove("hidden");
}

function setLoggedIn(isLoggedInState) {
  adminApp.classList.toggle("hidden", !isLoggedInState);
  authShell.classList.toggle("hidden", isLoggedInState);
  logoutBtn.classList.toggle("hidden", !isLoggedInState);
}

// ─── Rendering helpers ────────────────────────────────────────────────────────
function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderBingoPreview(items) {
  if (!items?.length) {
    return `<div class="empty-state">Chưa có ô bingo nào. Hãy nhập nội dung ở vùng phía trên.</div>`;
  }
  return `
    <div class="bingo-preview">
      ${items.map((item) => `<div class="bingo-cell">${escapeHtml(item)}</div>`).join("")}
    </div>
  `;
}

function renderSummaries() {
  const activeGames = state.games.filter((g) => g.enabled);
  const totalDuration = activeGames.reduce((sum, g) => sum + Number(g.duration || 0), 0);
  summaryGames.textContent = String(activeGames.length);
  summaryAttendees.textContent = String(state.attendees.length);
  summaryDuration.textContent = `${totalDuration} phút`;
}

function renderOverviewGames() {
  const activeGames = state.games.filter((g) => g.enabled);
  if (!activeGames.length) {
    adminOverviewGames.innerHTML = `<div class="empty-state">Chưa có game nào đang bật.</div>`;
    return;
  }

  adminOverviewGames.innerHTML = activeGames
    .map(
      (game, index) => `
        <article class="game-card ${index === 0 ? "featured" : ""}">
          <span class="tag">${game.duration} phút</span>
          <h3>${game.title}</h3>
          <p>${game.objective}</p>
          <ul>
            <li>Đạo cụ: ${game.supplies}</li>
            <li>Ghi chú: ${game.notes}</li>
          </ul>
          ${game.id === "bingo" ? renderBingoPreview(game.bingoItems) : ""}
        </article>
      `
    )
    .join("");
}

function renderBingoAdmin(game) {
  if (game.id !== "bingo") return "";
  const items = Array.isArray(game.bingoItems) ? game.bingoItems : [];
  return `
    <div class="field field-full">
      <span>Ô bingo</span>
      <p class="hint-text">Mỗi dòng là một ô. Bạn có thể nhập từ 9 đến 25 ô tùy kích thước phiếu bingo muốn in.</p>
      <textarea rows="10" data-field="bingoItems">${escapeHtml(items.join("\n"))}</textarea>
      <p class="hint-text">Hiện có ${items.length} ô.</p>
      ${renderBingoPreview(items)}
    </div>
  `;
}

function ensureGameSelection() {
  if (!state.games.some((g) => g.id === activeAdminGameId)) {
    activeAdminGameId = state.games[0]?.id ?? null;
  }
}

function renderAdminGames() {
  ensureGameSelection();

  adminGameTabs.innerHTML = state.games
    .map(
      (game, index) => `
        <button
          class="admin-game-tab ${game.id === activeAdminGameId ? "is-active" : ""}"
          type="button"
          data-admin-game-tab="${game.id}"
        >
          <strong>Game ${index + 1}</strong>
          <span>${escapeHtml(game.title)}</span>
        </button>
      `
    )
    .join("");

  const game = state.games.find((g) => g.id === activeAdminGameId);
  if (!game) return;

  adminGamesList.innerHTML = `
    <article class="admin-card" data-game-id="${game.id}">
      <header>
        <div>
          <h3>${game.title}</h3>
          <p>Admin có thể sửa nội dung hiển thị và bật tắt game đang chọn.</p>
        </div>
        <span class="badge ${game.enabled ? "badge-live" : "badge-off"}">
          ${game.enabled ? "Đang bật" : "Đang tắt"}
        </span>
      </header>

      <div class="form-grid">
        <label class="field">
          <span>Tên game</span>
          <input type="text" data-field="title" value="${escapeHtml(game.title)}" />
        </label>
        <label class="field">
          <span>Thời lượng (phút)</span>
          <input type="number" min="1" max="120" data-field="duration" value="${game.duration}" />
        </label>
        <label class="field field-full">
          <span>Mục tiêu</span>
          <textarea rows="3" data-field="objective">${escapeHtml(game.objective)}</textarea>
        </label>
        <label class="field field-full">
          <span>Đạo cụ</span>
          <textarea rows="2" data-field="supplies">${escapeHtml(game.supplies)}</textarea>
        </label>
        <label class="field field-full">
          <span>Ghi chú</span>
          <textarea rows="3" data-field="notes">${escapeHtml(game.notes)}</textarea>
        </label>
        ${renderBingoAdmin(game)}
      </div>

      <label class="toggle-row">
        <span>Bật game này trong chương trình</span>
        <input type="checkbox" data-field="enabled" ${game.enabled ? "checked" : ""} />
      </label>

      <div class="save-indicator" id="saveIndicator"></div>
    </article>
  `;
}

function renderAttendees() {
  attendeeCountLabel.textContent = `${state.attendees.length} người`;

  if (!state.attendees.length) {
    attendeeList.innerHTML = `<div class="empty-state">Chưa có người tham dự. Bạn có thể thêm tay hoặc import nhanh từ danh sách.</div>`;
    return;
  }

  attendeeList.innerHTML = state.attendees
    .map(
      (attendee) => `
        <div class="attendee-item">
          <div>
            <div class="attendee-name">${attendee.name}</div>
            <div class="attendee-status">${attendee.excluded ? "Đã trúng / đang ẩn khỏi pool" : "Đang trong pool quay"}</div>
          </div>
          <div class="inline-actions">
            <button class="button button-secondary" type="button" data-action="toggle-excluded" data-attendee-id="${attendee.id}">
              ${attendee.excluded ? "Mở lại" : "Ẩn khỏi pool"}
            </button>
            <button class="text-button" type="button" data-action="remove-attendee" data-attendee-id="${attendee.id}">Xóa</button>
          </div>
        </div>
      `
    )
    .join("");
}

function renderAdminApp() {
  renderSummaries();
  renderOverviewGames();
  renderAdminGames();
  renderAttendees();
}

// ─── Save indicator ───────────────────────────────────────────────────────────
function setSaveStatus(message, isError = false) {
  const el = document.getElementById("saveIndicator");
  if (!el) return;
  el.textContent = message;
  el.className = `save-indicator ${isError ? "save-error" : message ? "save-ok" : ""}`;
}

// ─── Game field update (debounced) ────────────────────────────────────────────
function updateLocalGameField(gameId, field, value) {
  const game = state.games.find((g) => g.id === gameId);
  if (!game) return;

  if (field === "enabled") {
    game.enabled = value;
  } else if (field === "duration") {
    game.duration = Math.max(1, Number(value) || 1);
  } else if (field === "bingoItems") {
    game.bingoItems = value
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean);
  } else {
    game[field] = value.trim?.() ?? value;
  }
}

async function saveGameToApi(gameId) {
  const game = state.games.find((g) => g.id === gameId);
  if (!game) return;
  setSaveStatus("Đang lưu...");
  try {
    await adminFetch(`/api/admin/games/${gameId}`, {
      method: "PUT",
      body: JSON.stringify(game),
    });
    setSaveStatus("✓ Đã lưu");
    setTimeout(() => setSaveStatus(""), 2000);
  } catch (err) {
    setSaveStatus(`Lỗi: ${err.message}`, true);
  } finally {
    pendingGameSave = null;
  }
}

function scheduleSave(gameId) {
  clearTimeout(pendingGameSave);
  pendingGameSave = setTimeout(() => saveGameToApi(gameId), 600);
}

// ─── Attendee operations ──────────────────────────────────────────────────────
async function addAttendee(name) {
  await adminFetch("/api/admin/attendees", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
  // State refresh comes via WS broadcast, but also manually for responsiveness
  await refreshAttendees();
}

async function importAttendees(names) {
  const result = await adminFetch("/api/admin/attendees/import", {
    method: "POST",
    body: JSON.stringify({ names }),
  });
  await refreshAttendees();
  return result;
}

async function removeAttendee(attendeeId) {
  await adminFetch(`/api/admin/attendees/${attendeeId}`, { method: "DELETE" });
  await refreshAttendees();
}

async function toggleAttendeeExcluded(attendeeId) {
  await adminFetch(`/api/admin/attendees/${attendeeId}/exclude`, { method: "PUT" });
  await refreshAttendees();
}

async function clearAttendees() {
  if (!confirm("Bạn chắc chắn muốn xóa toàn bộ danh sách tham dự?")) return;
  await adminFetch("/api/admin/attendees", { method: "DELETE" });
  await refreshAttendees();
}

async function refreshAttendees() {
  state.attendees = await adminFetch("/api/admin/attendees");
  renderAttendees();
  renderSummaries();
}

// ─── Login / Logout ───────────────────────────────────────────────────────────
async function handleLoginSubmit(event) {
  event.preventDefault();
  const username = loginUsernameInput.value.trim();
  const password = loginPasswordInput.value;

  if (!username || !password) {
    setAuthMessage("Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.", true);
    return;
  }

  loginForm.querySelector("button[type=submit]").disabled = true;

  try {
    const { token } = await adminFetch("/api/admin/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    setToken(token);
    setAuthMessage("");
    setLoggedIn(true);
    loginForm.reset();
    await fetchAdminState();
    renderAdminApp();
    connectAdminWebSocket();
  } catch (err) {
    setAuthMessage(err.message || "Sai tên đăng nhập hoặc mật khẩu.", true);
  } finally {
    loginForm.querySelector("button[type=submit]").disabled = false;
  }
}

function handleLogout() {
  clearToken();
  ws?.close();
  ws = null;
  setLoggedIn(false);
  showLoginMode();
  setAuthMessage("Đã đăng xuất khỏi trang admin.");
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
async function bootAuth() {
  if (isLoggedIn()) {
    try {
      await fetchAdminState();
      setLoggedIn(true);
      renderAdminApp();
      connectAdminWebSocket();
    } catch {
      clearToken();
      setLoggedIn(false);
      showLoginMode();
      setAuthMessage("Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.");
    }
  } else {
    showLoginMode();
    setLoggedIn(false);
    setAuthMessage("Nhập tên đăng nhập và mật khẩu để mở khu quản trị.");
  }
}

// ─── Event listeners ──────────────────────────────────────────────────────────
document.addEventListener("click", async (event) => {
  const adminGameTab = event.target.closest("[data-admin-game-tab]");
  if (adminGameTab) {
    activeAdminGameId = adminGameTab.dataset.adminGameTab;
    renderAdminGames();
    return;
  }

  const removeBtn = event.target.closest('[data-action="remove-attendee"]');
  if (removeBtn) {
    try {
      await removeAttendee(removeBtn.dataset.attendeeId);
    } catch (err) {
      alert(`Lỗi xóa: ${err.message}`);
    }
    return;
  }

  const toggleBtn = event.target.closest('[data-action="toggle-excluded"]');
  if (toggleBtn) {
    try {
      await toggleAttendeeExcluded(toggleBtn.dataset.attendeeId);
    } catch (err) {
      alert(`Lỗi cập nhật: ${err.message}`);
    }
    return;
  }
});

adminGamesList.addEventListener("input", (event) => {
  const field = event.target.dataset.field;
  if (!field) return;
  const card = event.target.closest("[data-game-id]");
  if (!card) return;
  const gameId = card.dataset.gameId;
  const value = event.target.type === "checkbox" ? event.target.checked : event.target.value;
  updateLocalGameField(gameId, field, value);
  scheduleSave(gameId);
  // Re-render badge & bingo preview inline without full re-render
  if (field === "enabled") {
    const badge = card.querySelector(".badge");
    if (badge) {
      badge.className = `badge ${value ? "badge-live" : "badge-off"}`;
      badge.textContent = value ? "Đang bật" : "Đang tắt";
    }
  }
  if (field === "bingoItems") {
    const game = state.games.find((g) => g.id === gameId);
    const previewEl = card.querySelector(".bingo-preview, .empty-state");
    if (previewEl && game) {
      previewEl.outerHTML = renderBingoPreview(game.bingoItems);
    }
  }
});

adminGamesList.addEventListener("change", (event) => {
  const field = event.target.dataset.field;
  if (!field) return;
  const card = event.target.closest("[data-game-id]");
  if (!card) return;
  const gameId = card.dataset.gameId;
  const value = event.target.type === "checkbox" ? event.target.checked : event.target.value;
  updateLocalGameField(gameId, field, value);
  // Immediate save for checkboxes; textarea/inputs already debounced via input event
  if (event.target.type === "checkbox") {
    saveGameToApi(gameId);
    renderAdminGames(); // refresh badge
  }
});

attendeeForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = attendeeNameInput.value.trim();
  if (!name) return;
  try {
    await addAttendee(name);
    attendeeNameInput.value = "";
  } catch (err) {
    alert(`Lỗi thêm người tham dự: ${err.message}`);
  }
});

importAttendeesBtn.addEventListener("click", async () => {
  const raw = bulkImportInput.value;
  const names = raw.split(/\r?\n|,/).map((n) => n.trim()).filter(Boolean);
  if (!names.length) return;
  try {
    const result = await importAttendees(names);
    bulkImportInput.value = "";
    alert(`Đã thêm ${result.added} người. Bỏ qua ${result.skipped} trùng lặp.`);
  } catch (err) {
    alert(`Lỗi import: ${err.message}`);
  }
});

clearAttendeesBtn.addEventListener("click", async () => {
  try {
    await clearAttendees();
  } catch (err) {
    alert(`Lỗi xóa danh sách: ${err.message}`);
  }
});

logoutBtn.addEventListener("click", handleLogout);
loginForm.addEventListener("submit", handleLoginSubmit);

// ─── Init ─────────────────────────────────────────────────────────────────────
bootAuth();
