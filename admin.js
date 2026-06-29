const STORAGE_KEY = "reunion-games-admin-state-v1";
const ADMIN_HASH_KEY = "reunion-admin-password-hash-v1";
const ADMIN_SESSION_KEY = "reunion-admin-session-v1";

const defaultState = {
  attendees: [],
  games: [
    {
      id: "bingo",
      title: "Bingo Ký Ức Lớp Mình",
      duration: 12,
      enabled: true,
      objective: "Phá băng và kéo mọi người bắt chuyện ngay từ đầu buổi.",
      supplies: "Phiếu bingo, bút, sticker check-in.",
      notes: "Nên đặt 12-16 ô có nội dung liên quan kỷ niệm của lớp.",
      bingoItems: [
        "Từng ngồi bàn cuối",
        "Hay ngủ gật trong giờ",
        "Từng bị ghi sổ đầu bài",
        "Lần đầu đi họp lớp sau 10 năm",
        "Từng làm lớp phó",
        "Hay đi học muộn",
        "Có ảnh kỷ yếu siêu hài",
        "Từng trốn tiết thành công",
        "Hay bị gọi lên bảng",
        "Từng tham gia văn nghệ",
        "Từng trực nhật cùng bạn",
        "Từng mượn bài chép gấp",
      ],
    },
    {
      id: "image",
      title: "Đuổi Hình Bắt Kỷ Niệm",
      duration: 15,
      enabled: true,
      objective: "Gợi lại chuyện cũ thông qua ảnh lớp, sự kiện và nhân vật quen thuộc.",
      supplies: "Slide ảnh, màn chiếu, chuông hoặc bảng đáp án.",
      notes: "Có thể dùng ảnh crop một phần để tăng độ khó.",
    },
    {
      id: "memory",
      title: "Ai Là Chủ Nhân Kỷ Niệm Này",
      duration: 20,
      enabled: true,
      objective: "Làm nổi bật từng thành viên bằng các mẩu chuyện ẩn danh vui.",
      supplies: "Form thu kỷ niệm, micro, màn chiếu.",
      notes: "Thu kỷ niệm trước ngày tổ chức 3-5 ngày.",
    },
    {
      id: "relay",
      title: "Truyền Tin Phiên Bản 10 Năm Sau",
      duration: 15,
      enabled: true,
      objective: "Tạo tiếng cười qua việc truyền sai thông điệp giữa các thành viên.",
      supplies: "Giấy, bút, bộ câu nói ngắn.",
      notes: "Nhớ chọn nội dung vui, gọn, dễ nghe nhầm.",
    },
    {
      id: "tower",
      title: "Xây Tháp Cam Kết",
      duration: 18,
      enabled: true,
      objective: "Kết thúc vui cho chương trình và khuyến khích mọi người gửi lời chúc.",
      supplies: "Ly giấy, dây, bảng điểm.",
      notes: "Mỗi lượt đặt ly cần nói một điều tốt đẹp cho lần gặp sau.",
    },
  ],
};

let state = loadState();
let activeAdminGameId = state.games[0]?.id ?? null;

const authShell = document.getElementById("authShell");
const setupCard = document.getElementById("setupCard");
const loginCard = document.getElementById("loginCard");
const authMessage = document.getElementById("authMessage");
const setupForm = document.getElementById("setupForm");
const loginForm = document.getElementById("loginForm");
const setupPasswordInput = document.getElementById("setupPasswordInput");
const setupPasswordConfirmInput = document.getElementById("setupPasswordConfirmInput");
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

function loadState() {
  const saved = window.localStorage.getItem(STORAGE_KEY);
  const defaultsById = Object.fromEntries(defaultState.games.map((game) => [game.id, game]));

  if (!saved) {
    return structuredClone(defaultState);
  }

  try {
    const parsed = JSON.parse(saved);
    const parsedGames = Array.isArray(parsed.games) && parsed.games.length ? parsed.games : defaultState.games;
    const games = parsedGames.map((game) => {
      const defaults = defaultsById[game.id] ?? {};
      return {
        ...structuredClone(defaults),
        ...game,
        bingoItems: Array.isArray(game.bingoItems)
          ? game.bingoItems.filter(Boolean)
          : Array.isArray(defaults.bingoItems)
            ? structuredClone(defaults.bingoItems)
            : undefined,
      };
    });

    return {
      games,
      attendees: Array.isArray(parsed.attendees) ? parsed.attendees : [],
    };
  } catch (error) {
    return structuredClone(defaultState);
  }
}

function saveState() {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

async function sha256Hex(input) {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function getStoredHash() {
  return window.localStorage.getItem(ADMIN_HASH_KEY);
}

function setAuthMessage(message, isError = false) {
  authMessage.textContent = message;
  authMessage.classList.toggle("is-error", isError);
  authMessage.classList.toggle("is-success", Boolean(message) && !isError);
}

function showSetupMode() {
  setupCard.classList.remove("hidden");
  loginCard.classList.add("hidden");
}

function showLoginMode() {
  setupCard.classList.add("hidden");
  loginCard.classList.remove("hidden");
}

function setLoggedIn(isLoggedIn) {
  adminApp.classList.toggle("hidden", !isLoggedIn);
  authShell.classList.toggle("hidden", isLoggedIn);
  logoutBtn.classList.toggle("hidden", !isLoggedIn);
}

function ensureGameSelection() {
  if (!state.games.some((game) => game.id === activeAdminGameId)) {
    activeAdminGameId = state.games[0]?.id ?? null;
  }
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
  const activeGames = state.games.filter((game) => game.enabled);
  const totalDuration = activeGames.reduce((sum, game) => sum + Number(game.duration || 0), 0);
  summaryGames.textContent = String(activeGames.length);
  summaryAttendees.textContent = String(state.attendees.length);
  summaryDuration.textContent = `${totalDuration} phút`;
}

function renderOverviewGames() {
  const activeGames = state.games.filter((game) => game.enabled);
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
  if (game.id !== "bingo") {
    return "";
  }

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

  const game = state.games.find((item) => item.id === activeAdminGameId);
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

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function addAttendees(names) {
  const existing = new Set(state.attendees.map((attendee) => attendee.name.toLowerCase()));
  const cleanNames = names
    .map((name) => name.trim())
    .filter(Boolean)
    .filter((name) => !existing.has(name.toLowerCase()));

  cleanNames.forEach((name) => {
    state.attendees.push({
      id: crypto.randomUUID(),
      name,
      excluded: false,
    });
    existing.add(name.toLowerCase());
  });
}

function updateGameField(gameId, field, value) {
  const game = state.games.find((item) => item.id === gameId);
  if (!game) {
    return;
  }

  if (field === "enabled") {
    game.enabled = value;
    return;
  }

  if (field === "duration") {
    game.duration = Math.max(1, Number(value) || 1);
    return;
  }

  if (field === "bingoItems") {
    game.bingoItems = value
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean);
    return;
  }

  game[field] = value.trim();
}

function removeAttendee(attendeeId) {
  state.attendees = state.attendees.filter((attendee) => attendee.id !== attendeeId);
  saveState();
  renderAdminApp();
}

function toggleAttendeeExcluded(attendeeId) {
  const attendee = state.attendees.find((item) => item.id === attendeeId);
  if (!attendee) {
    return;
  }

  attendee.excluded = !attendee.excluded;
  saveState();
  renderAdminApp();
}

function clearAttendees() {
  state.attendees = [];
  saveState();
  renderAdminApp();
}

async function handleSetupSubmit(event) {
  event.preventDefault();
  const password = setupPasswordInput.value;
  const confirmPassword = setupPasswordConfirmInput.value;

  if (password.length < 6) {
    setAuthMessage("Mật khẩu nên có ít nhất 6 ký tự.", true);
    return;
  }

  if (password !== confirmPassword) {
    setAuthMessage("Mật khẩu nhập lại chưa khớp.", true);
    return;
  }

  const hash = await sha256Hex(password);
  window.localStorage.setItem(ADMIN_HASH_KEY, hash);
  window.sessionStorage.setItem(ADMIN_SESSION_KEY, "ok");
  setAuthMessage("Đã tạo mật khẩu admin thành công.", false);
  setLoggedIn(true);
  renderAdminApp();
  setupForm.reset();
}

async function handleLoginSubmit(event) {
  event.preventDefault();
  const password = loginPasswordInput.value;
  const storedHash = getStoredHash();
  const hash = await sha256Hex(password);

  if (!storedHash || hash !== storedHash) {
    setAuthMessage("Mật khẩu chưa đúng.", true);
    return;
  }

  window.sessionStorage.setItem(ADMIN_SESSION_KEY, "ok");
  setAuthMessage("");
  setLoggedIn(true);
  renderAdminApp();
  loginForm.reset();
}

function handleLogout() {
  window.sessionStorage.removeItem(ADMIN_SESSION_KEY);
  setLoggedIn(false);
  showLoginMode();
  setAuthMessage("Đã đăng xuất khỏi trang admin.");
}

function bootAuth() {
  const storedHash = getStoredHash();
  const loggedIn = window.sessionStorage.getItem(ADMIN_SESSION_KEY) === "ok";

  if (!storedHash) {
    showSetupMode();
    setLoggedIn(false);
    setAuthMessage("Hãy tạo mật khẩu admin trước khi sử dụng.");
    return;
  }

  if (loggedIn) {
    setLoggedIn(true);
    renderAdminApp();
    return;
  }

  showLoginMode();
  setLoggedIn(false);
  setAuthMessage("Nhập mật khẩu để mở khu quản trị.");
}

document.addEventListener("click", (event) => {
  const adminGameTab = event.target.closest("[data-admin-game-tab]");
  if (adminGameTab) {
    activeAdminGameId = adminGameTab.dataset.adminGameTab;
    renderAdminGames();
  }

  const removeBtn = event.target.closest('[data-action="remove-attendee"]');
  if (removeBtn) {
    removeAttendee(removeBtn.dataset.attendeeId);
  }

  const toggleBtn = event.target.closest('[data-action="toggle-excluded"]');
  if (toggleBtn) {
    toggleAttendeeExcluded(toggleBtn.dataset.attendeeId);
  }
});

adminGamesList.addEventListener("input", (event) => {
  const field = event.target.dataset.field;
  if (!field) {
    return;
  }

  const card = event.target.closest("[data-game-id]");
  updateGameField(card.dataset.gameId, field, event.target.type === "checkbox" ? event.target.checked : event.target.value);
  saveState();
  renderAdminApp();
});

adminGamesList.addEventListener("change", (event) => {
  const field = event.target.dataset.field;
  if (!field) {
    return;
  }

  const card = event.target.closest("[data-game-id]");
  updateGameField(card.dataset.gameId, field, event.target.type === "checkbox" ? event.target.checked : event.target.value);
  saveState();
  renderAdminApp();
});

attendeeForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = attendeeNameInput.value.trim();
  if (!name) {
    return;
  }

  addAttendees([name]);
  attendeeNameInput.value = "";
  saveState();
  renderAdminApp();
});

importAttendeesBtn.addEventListener("click", () => {
  const names = bulkImportInput.value.split(/\r?\n|,/);
  addAttendees(names);
  bulkImportInput.value = "";
  saveState();
  renderAdminApp();
});

clearAttendeesBtn.addEventListener("click", clearAttendees);
logoutBtn.addEventListener("click", handleLogout);
setupForm.addEventListener("submit", handleSetupSubmit);
loginForm.addEventListener("submit", handleLoginSubmit);

bootAuth();
