// ─── Auth & API ──────────────────────────────────────────────────────────────
const ADMIN_SESSION_KEY = "reunion-admin-jwt";

let state = { games: [], attendees: [] };
let activeAdminGameId = null;
const dirtyGames = new Set();
let ws = null;
let renderQueued = false;

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
  const method = options.method || "GET";
  console.log(`🌐 ${method} ${path}`);
  const res = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });

  if (res.status === 401) {
    console.log(`🌐 ${method} ${path} → 401 Unauthorized`);
    clearToken();
    setLoggedIn(false);
    showLoginMode();
    setAuthMessage("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
    throw new Error("Unauthorized");
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    console.error(`🌐 ${method} ${path} → ${res.status} ${err.error}`);
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }

  console.log(`🌐 ${method} ${path} → ${res.status}`);
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

// ─── Debounced render ────────────────────────────────────────────────────────
function scheduleAdminRender() {
  if (!renderQueued) {
    renderQueued = true;
    requestAnimationFrame(() => {
      renderQueued = false;
      renderAdminApp();
    });
  }
}

// ─── WebSocket ────────────────────────────────────────────────────────────────
function connectAdminWebSocket() {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  console.log(`🔌 WS connecting to ${protocol}//${location.host}/ws`);
  ws = new WebSocket(`${protocol}//${location.host}/ws`);

  ws.addEventListener("open", () => {
    console.log("🔌 WS connected (admin)");
  });

  ws.addEventListener("message", (event) => {
    try {
      const { event: evtName, data } = JSON.parse(event.data);
      console.log(`📡 WS received "${evtName}"`);
      if (evtName === "state_update") {
        // Only refresh if no unsaved changes (avoid overwriting in-progress edits)
        if (dirtyGames.size === 0) {
          if (Array.isArray(data.games)) state.games = data.games;
          if (Array.isArray(data.attendees)) state.attendees = data.attendees;
          scheduleAdminRender();
        } else {
          console.log(`  ⏭️  state_update skipped — ${dirtyGames.size} game(s) dirty`);
        }
      }
    } catch {
      // Ignore malformed messages
    }
  });

  ws.addEventListener("close", () => {
    console.log("🔌 WS disconnected (admin) — reconnecting in 3s");
    ws = null;
    setTimeout(connectAdminWebSocket, 3000);
  });

  ws.addEventListener("error", () => {
    console.error("🔌 WS error");
    ws?.close();
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

function getBingoSize(game) {
  const size = game.bingoSize;
  if (size && size.rows >= 3 && size.rows <= 5 && size.cols >= 3 && size.cols <= 5) {
    return size;
  }
  // Default to 4x4
  return { rows: 4, cols: 4 };
}

function getBingoGridItems(items, size, hasFreeSpace) {
  const total = size.rows * size.cols;
  const filled = Array.isArray(items) ? [...items] : [];
  // Pad with empty strings to fill the grid
  while (filled.length < total) filled.push("");
  const grid = [];
  for (let r = 0; r < size.rows; r++) {
    const row = [];
    for (let c = 0; c < size.cols; c++) {
      const idx = r * size.cols + c;
      const isFree = hasFreeSpace && size.rows % 2 === 1 && size.cols % 2 === 1 && r === Math.floor(size.rows / 2) && c === Math.floor(size.cols / 2);
      row.push({
        text: isFree ? "★ FREE" : (filled[idx] || ""),
        isEmpty: !filled[idx] && !isFree,
        isFree,
      });
    }
    grid.push(row);
  }
  return grid;
}

function renderBingoPreview(items, size, hasFreeSpace) {
  if (!items?.length && !hasFreeSpace) {
    return `<div class="empty-state">Chưa có ô bingo nào. Hãy nhập nội dung ở vùng phía trên.</div>`;
  }
  const gridSize = size || getBingoSize({ bingoSize: null });
  const grid = getBingoGridItems(items, gridSize, hasFreeSpace);
  return `
    <div class="bingo-board" style="--bingo-cols: ${gridSize.cols}; --bingo-rows: ${gridSize.rows};">
      ${grid.map(row => row.map(cell => `
        <div class="bingo-cell ${cell.isFree ? "bingo-cell-free" : ""} ${cell.isEmpty ? "bingo-cell-empty" : ""}">
          ${escapeHtml(cell.text)}
        </div>
      `).join("")).join("")}
    </div>
  `;
}

function renderOverviewGames() {
  const activeGames = state.games.filter((g) => g.enabled);
  if (!activeGames.length) {
    adminOverviewGames.innerHTML = `<div class="empty-state">Chưa có game nào đang bật.</div>`;
    return;
  }

  adminOverviewGames.innerHTML = activeGames
    .map(
      (game, index) => {
        let bingoHtml = "";
        if (game.id === "bingo") {
          const size = getBingoSize(game);
          const hasFree = Boolean(game.bingoFreeSpace);
          bingoHtml = renderBingoPreview(game.bingoItems, size, hasFree);
        }
        return `
        <article class="game-card ${index === 0 ? "featured" : ""}">
          <span class="tag">${game.duration} phút</span>
          <h3>${game.title}</h3>
          <p>${game.objective}</p>
          <ul>
            <li>Đạo cụ: ${game.supplies}</li>
            <li>Ghi chú: ${game.notes}</li>
          </ul>
          ${bingoHtml}
        </article>
      `;
      }
    )
    .join("");
}

function renderBingoAdmin(game) {
  if (game.id !== "bingo") return "";
  const items = Array.isArray(game.bingoItems) ? game.bingoItems : [];
  const size = getBingoSize(game);
  const hasFreeSpace = Boolean(game.bingoFreeSpace);
  const totalCells = size.rows * size.cols;
  const neededItems = hasFreeSpace && size.rows % 2 === 1 && size.cols % 2 === 1 ? totalCells - 1 : totalCells;
  const statusClass = items.length < neededItems ? "bingo-status-warn" : items.length > neededItems ? "bingo-status-over" : "bingo-status-ok";
  const diff = neededItems - items.length;
  let statusText = `${items.length} / ${neededItems} ô`;
  if (diff > 0) {
    statusText += ` — cần thêm ${diff} ô nữa`;
  } else if (diff < 0) {
    statusText += ` — dư ${Math.abs(diff)} ô (sẽ bị ẩn khỏi bảng)`;
  } else {
    statusText += ` — vừa đủ ✓`;
  }

  // Size presets
  const presets = [
    { rows: 3, cols: 3, label: "3×3" },
    { rows: 4, cols: 4, label: "4×4" },
    { rows: 5, cols: 5, label: "5×5" },
    { rows: 4, cols: 3, label: "4×3" },
    { rows: 3, cols: 4, label: "3×4" },
  ];
  const allowFreeSpace = size.rows % 2 === 1 && size.cols % 2 === 1;

  return `
    <div class="field field-full bingo-admin-section">
      <span>Cấu hình bảng Bingo</span>

      <div class="bingo-size-selector">
        <label class="field-label">Kích thước bảng</label>
        <div class="bingo-size-options">
          ${presets.map(p => `
            <button
              type="button"
              class="bingo-size-btn ${size.rows === p.rows && size.cols === p.cols ? "is-active" : ""}"
              data-bingo-size="${p.rows},${p.cols}"
            >${p.label}</button>
          `).join("")}
        </div>
      </div>

      ${allowFreeSpace ? `
        <label class="toggle-row bingo-free-toggle">
          <span>Ô trung tâm miễn phí (FREE)</span>
          <input type="checkbox" data-bingo-free="true" ${hasFreeSpace ? "checked" : ""} />
        </label>
      ` : `<p class="hint-text">Ô FREE chỉ khả dụng với bảng vuông lẻ (3×3, 5×5).</p>`}

      <hr class="bingo-divider" />

      <span>Nội dung các ô</span>
      <p class="hint-text">Mỗi dòng là một ô. Số ô cần bằng đúng kích thước bảng (trừ ô FREE).</p>
      <textarea rows="10" data-field="bingoItems" placeholder="Nhập từng ô bingo, mỗi dòng một ô...">${escapeHtml(items.join("\n"))}</textarea>
      <p class="hint-text ${statusClass}" id="bingoItemStatus">${statusText}</p>
      ${renderBingoPreview(items, size, hasFreeSpace)}
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

      <div class="save-bar">
        <button class="button" type="button" data-action="save-game" data-game-id="${game.id}">Lưu thay đổi</button>
        <span class="save-indicator" id="saveIndicator"></span>
      </div>
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
  } else if (field === "bingoSize") {
    const [rows, cols] = value.split(",").map(Number);
    game.bingoSize = { rows, cols };
  } else if (field === "bingoFreeSpace") {
    game.bingoFreeSpace = value;
  } else {
    game[field] = value.trim?.() ?? value;
  }
}

function markDirty(gameId) {
  dirtyGames.add(gameId);
  setSaveStatus("⚠ Chưa lưu");
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
    dirtyGames.clear();
    setTimeout(() => setSaveStatus(""), 2000);
  } catch (err) {
    console.error("saveGameToApi error:", err);
    setSaveStatus(`Lỗi: ${err.message}`, true);
  }
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
    // Show admin shell and loading placeholder immediately — don't wait for API
    setLoggedIn(true);
    adminOverviewGames.innerHTML = `<div class="empty-state">Đang tải dữ liệu...</div>`;
    adminGamesList.innerHTML = `<div class="empty-state">Đang tải dữ liệu...</div>`;
    attendeeList.innerHTML = `<div class="empty-state">Đang tải dữ liệu...</div>`;

    try {
      await fetchAdminState();
      renderAdminApp();
      connectAdminWebSocket();
    } catch {
      clearToken();
      setLoggedIn(false);
      showLoginMode();
      setAuthMessage("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
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

  const saveBtn = event.target.closest('[data-action="save-game"]');
  if (saveBtn) {
    const gameId = saveBtn.dataset.gameId;
    if (gameId) {
      await saveGameToApi(gameId);
      // Không gọi renderAdminGames() ở đây — saveGameToApi() tự cập nhật indicator
    }
    return;
  }

  const sizeBtn = event.target.closest("[data-bingo-size]");
  if (sizeBtn) {
    const card = sizeBtn.closest("[data-game-id]");
    if (!card) return;
    const gameId = card.dataset.gameId;
    const size = sizeBtn.dataset.bingoSize;
    updateLocalGameField(gameId, "bingoSize", size);
    markDirty(gameId);
    renderAdminGames();
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
  markDirty(gameId);
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
    if (!game) return;
    const size = getBingoSize(game);
    const hasFree = Boolean(game.bingoFreeSpace);
    const adminSection = card.querySelector(".bingo-admin-section");
    if (adminSection) {
      // Update status text
      const statusEl = adminSection.querySelector("#bingoItemStatus");
      if (statusEl) {
        const items = game.bingoItems || [];
        const totalCells = size.rows * size.cols;
        const neededItems = hasFree && size.rows % 2 === 1 && size.cols % 2 === 1 ? totalCells - 1 : totalCells;
        const diff = neededItems - items.length;
        let text = `${items.length} / ${neededItems} ô`;
        if (diff > 0) text += ` — cần thêm ${diff} ô nữa`;
        else if (diff < 0) text += ` — dư ${Math.abs(diff)} ô (sẽ bị ẩn khỏi bảng)`;
        else text += ` — vừa đủ ✓`;
        statusEl.textContent = text;
        statusEl.className = `hint-text ${items.length < neededItems ? "bingo-status-warn" : items.length > neededItems ? "bingo-status-over" : "bingo-status-ok"}`;
      }
      // Update preview
      const prevPreview = adminSection.querySelector(".bingo-board, .empty-state");
      if (prevPreview) {
        prevPreview.outerHTML = renderBingoPreview(game.bingoItems, size, hasFree);
      }
    }
  }
});



document.addEventListener("change", (event) => {
  const field = event.target.dataset.field;
  if (field) {
    const card = event.target.closest("[data-game-id]");
    if (!card) return;
    const gameId = card.dataset.gameId;
    const value = event.target.type === "checkbox" ? event.target.checked : event.target.value;
    updateLocalGameField(gameId, field, value);
    markDirty(gameId);
    return;
  }

  const freeCheck = event.target.closest("[data-bingo-free]");
  if (freeCheck) {
    const card = freeCheck.closest("[data-game-id]");
    if (!card) return;
    const gameId = card.dataset.gameId;
    updateLocalGameField(gameId, "bingoFreeSpace", freeCheck.checked);
    markDirty(gameId);
    renderAdminGames();
    return;
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
