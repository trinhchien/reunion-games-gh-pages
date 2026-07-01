// ─── State ───────────────────────────────────────────────────────────────────
let state = { games: [], attendees: [] };
let currentRotation = 0;
let wheelSpinning = false;
let activePublicTab = "wheel";
let playerSession = null; // { phone, name, id }
let ws = null;
let renderQueued = false;
let lastEnabledGameIds = "";

const palette = ["#c76431", "#dd8b52", "#efb168", "#ad4e2d", "#e48d78", "#f2c38b", "#9d6b4a", "#7f4732"];

const heroGameActions = document.getElementById("heroGameActions");
const publicTabStrip = document.getElementById("publicTabStrip");
const publicPanels = document.getElementById("publicPanels");

// ─── Utilities ────────────────────────────────────────────────────────────────
function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

// Fisher-Yates shuffle — returns a new array
function shuffleArray(arr) {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Cache shuffled bingo items so the board doesn't re-shuffle on every re-render
let bingoShuffleCache = null;

function getShuffledBingoItems(items) {
  const key = JSON.stringify(items);
  if (bingoShuffleCache && bingoShuffleCache.key === key) {
    return bingoShuffleCache.items;
  }
  const shuffled = shuffleArray(items || []);
  bingoShuffleCache = { key, items: shuffled };
  return shuffled;
}

// ─── API Helpers ──────────────────────────────────────────────────────────────
async function apiFetch(path, options = {}) {
  const method = options.method || "GET";
  console.log(`🌐 ${method} ${path}`);
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Network error" }));
    console.error(`🌐 ${method} ${path} → ${res.status} ${err.error}`);
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  console.log(`🌐 ${method} ${path} → ${res.status}`);
  return res.json();
}

async function fetchState() {
  try {
    const [games, attendees] = await Promise.all([
      apiFetch("/api/games"),
      apiFetch("/api/attendees"),
    ]);
    state = { games, attendees };
  } catch (err) {
    console.error("Không thể tải dữ liệu:", err);
  }
}

// ─── WebSocket ────────────────────────────────────────────────────────────────
function scheduleRender() {
  if (!renderQueued) {
    renderQueued = true;
    requestAnimationFrame(() => {
      renderQueued = false;
      renderAll();
    });
  }
}

function connectWebSocket() {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  console.log(`🔌 WS connecting to ${protocol}//${location.host}/ws`);
  ws = new WebSocket(`${protocol}//${location.host}/ws`);

  ws.addEventListener("open", () => {
    console.log("🔌 WS connected");
  });

  ws.addEventListener("message", (event) => {
    try {
      const { event: evtName, data } = JSON.parse(event.data);
      console.log(`📡 WS received "${evtName}"`);
      if (evtName === "state_update") {
        if (Array.isArray(data.games)) state.games = data.games;
        if (Array.isArray(data.attendees)) state.attendees = data.attendees;
        scheduleRender();
      } else if (evtName === "wheel_result" && !wheelSpinning) {
        const winnerBox = document.getElementById("winnerBox");
        if (winnerBox && data.winner) {
          winnerBox.innerHTML = `<strong>${escapeHtml(data.winner.name)}</strong>Người may mắn vừa được chọn từ vòng quay.`;
        }
      }
    } catch {
      // Ignore malformed messages
    }
  });

  ws.addEventListener("close", () => {
    console.log("🔌 WS disconnected — reconnecting in 3s");
    ws = null;
    scheduleRender();
    setTimeout(connectWebSocket, 3000);
  });

  ws.addEventListener("error", () => {
    ws?.close();
  });
}

// ─── Rendering ────────────────────────────────────────────────────────────────
function getEnabledGames() {
  return state.games.filter((g) => g.enabled);
}

function getEligibleAttendees() {
  return state.attendees.filter((a) => !a.excluded);
}

function getBingoSize(game) {
  const size = game.bingoSize;
  if (size && size.rows >= 3 && size.rows <= 5 && size.cols >= 3 && size.cols <= 5) {
    return size;
  }
  return { rows: 4, cols: 4 };
}

function getBingoGridItems(items, size, hasFreeSpace) {
  const total = size.rows * size.cols;
  const filled = Array.isArray(items) ? [...items] : [];
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
    return `<div class="empty-state">Chưa có ô bingo nào. Ban tổ chức cần cập nhật từ trang admin.</div>`;
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

function renderGamePanel(game) {
  if (!playerSession) {
    return `
      <section class="tab-panel ${activePublicTab === game.id ? "is-active" : ""}" data-tab-panel="${game.id}">
        <section class="section">
          <div class="panel">
            <div class="section-heading compact">
              <h2>${escapeHtml(game.title)}</h2>
            </div>
            <div class="gate-locked">
              <p>Bạn cần nhập số điện thoại để tham gia trò chơi.</p>
              <button class="button" type="button" id="gateJoinBtn">Nhập số điện thoại</button>
            </div>
          </div>
        </section>
      </section>
    `;
  }

  if (game.id === "bingo") {
    // Shuffle items so each user/view sees a random board
    const shuffledItems = getShuffledBingoItems(game.bingoItems);
    return `
      <section class="tab-panel ${activePublicTab === game.id ? "is-active" : ""}" data-tab-panel="${game.id}">
        <section class="section">
          <div class="panel">
            <div class="section-heading compact">
              <p class="eyebrow">Bingo riêng</p>
              <h2>${escapeHtml(game.title)}</h2>
            </div>
            <p>${escapeHtml(game.objective)}</p>
            <div class="inline-actions">
              <span class="tag">${game.duration} phút</span>
            </div>
            ${renderBingoPreview(shuffledItems, getBingoSize(game), Boolean(game.bingoFreeSpace))}
          </div>
        </section>
      </section>
    `;
  }

  if (game.id === "wheel") {
    return `
      <section class="tab-panel wheel-panel-inner ${activePublicTab === game.id ? "is-active" : ""}" data-tab-panel="${game.id}">
        <section class="section split-section wheel-layout">
          <div class="panel wheel-panel">
            <div class="section-heading compact">
              <p class="eyebrow">Lucky wheel</p>
              <h2>${escapeHtml(game.title)}</h2>
            </div>
            <p>${escapeHtml(game.objective)}</p>
            <div class="wheel-stage">
              <canvas id="wheelCanvas" width="520" height="520" aria-label="Vòng quay may mắn"></canvas>
              <div class="wheel-pointer"></div>
            </div>
            <div class="inline-actions">
              <button class="button" id="spinWheelBtn" type="button">Quay ngay</button>
              <button class="button button-secondary" id="resetWinnersBtn" type="button">Mở lại tất cả</button>
            </div>
            <label class="toggle-row">
              <input id="removeWinnerToggle" type="checkbox" checked />
              <span>Tự động ẩn người đã trúng khỏi lần quay sau</span>
            </label>
            <div class="winner-box" id="winnerBox">Chưa có kết quả. Hãy quay để chọn người may mắn.</div>
          </div>
        </section>
      </section>
    `;
  }

  return `
    <section class="tab-panel ${activePublicTab === game.id ? "is-active" : ""}" data-tab-panel="${game.id}">
      <section class="section">
        <div class="panel">
          <div class="section-heading compact">
            <p class="eyebrow">Game đang bật</p>
            <h2>${escapeHtml(game.title)}</h2>
          </div>
          <p>${escapeHtml(game.objective)}</p>
          <div class="inline-actions">
            <span class="tag">${game.duration} phút</span>
          </div>
          <ul class="checklist">
            <li>Đạo cụ: ${escapeHtml(game.supplies)}</li>
            <li>Ghi chú: ${escapeHtml(game.notes)}</li>
          </ul>
        </div>
      </section>
    </section>
  `;
}

function renderPublicTabs() {
  const enabledGames = getEnabledGames();
  const newIds = enabledGames.map(g => g.id).sort().join(",");
  const gamesChanged = newIds !== lastEnabledGameIds;

  if (!enabledGames.some((g) => g.id === activePublicTab) && activePublicTab !== "wheel") {
    activePublicTab = enabledGames[0]?.id ?? "wheel";
  }

  // Only rebuild tab navigation when enabled games set changes
  if (gamesChanged) {
    lastEnabledGameIds = newIds;

    publicTabStrip.innerHTML = enabledGames
      .map(
        (game) => `
          <button class="tab-chip ${activePublicTab === game.id ? "is-active" : ""}" type="button" data-tab-target="${game.id}">
            ${escapeHtml(game.title)}
          </button>
        `
      )
      .join("");

    heroGameActions.innerHTML = enabledGames
      .slice(0, 2)
      .map(
        (game, index) => `
          <button
            class="button ${index === 0 ? "" : "button-secondary"}"
            type="button"
            data-tab-target="${game.id}"
          >
            ${escapeHtml(game.title)}
          </button>
        `
      )
      .join("");
  } else {
    // Just update active tab chip
    const chips = publicTabStrip.querySelectorAll(".tab-chip");
    chips.forEach(chip => {
      chip.classList.toggle("is-active", chip.dataset.tabTarget === activePublicTab);
    });
  }

  publicPanels.innerHTML = enabledGames.map(renderGamePanel).join("");
}

// ─── Wheel Drawing ────────────────────────────────────────────────────────────
function drawWheel(rotation = currentRotation, pool = getEligibleAttendees()) {
  const wheelCanvas = document.getElementById("wheelCanvas");
  if (!wheelCanvas) return;

  const wheelCtx = wheelCanvas.getContext("2d");
  const size = wheelCanvas.width;
  const radius = size / 2;
  wheelCtx.clearRect(0, 0, size, size);

  if (!pool.length) {
    wheelCtx.save();
    wheelCtx.translate(radius, radius);
    wheelCtx.beginPath();
    wheelCtx.arc(0, 0, radius - 12, 0, Math.PI * 2);
    wheelCtx.fillStyle = "#f4e7d7";
    wheelCtx.fill();
    wheelCtx.fillStyle = "#964522";
    wheelCtx.font = "700 22px 'Be Vietnam Pro'";
    wheelCtx.textAlign = "center";
    wheelCtx.fillText("Chưa có người hợp lệ", 0, -8);
    wheelCtx.font = "400 16px 'Be Vietnam Pro'";
    wheelCtx.fillText("Vào trang admin để thêm danh sách", 0, 24);
    wheelCtx.restore();
    return;
  }

  const sliceAngle = (Math.PI * 2) / pool.length;
  wheelCtx.save();
  wheelCtx.translate(radius, radius);
  wheelCtx.rotate(rotation);

  pool.forEach((attendee, index) => {
    const start = index * sliceAngle;
    const end = start + sliceAngle;
    wheelCtx.beginPath();
    wheelCtx.moveTo(0, 0);
    wheelCtx.arc(0, 0, radius - 12, start, end);
    wheelCtx.closePath();
    wheelCtx.fillStyle = palette[index % palette.length];
    wheelCtx.fill();

    wheelCtx.save();
    wheelCtx.rotate(start + sliceAngle / 2);
    wheelCtx.textAlign = "right";
    wheelCtx.fillStyle = "#ffffff";
    wheelCtx.font = "600 18px 'Be Vietnam Pro'";
    wheelCtx.fillText(attendee.name.slice(0, 18), radius - 28, 6);
    wheelCtx.restore();
  });

  wheelCtx.beginPath();
  wheelCtx.arc(0, 0, 36, 0, Math.PI * 2);
  wheelCtx.fillStyle = "#fff7ef";
  wheelCtx.fill();
  wheelCtx.fillStyle = "#964522";
  wheelCtx.font = "700 16px 'Space Grotesk'";
  wheelCtx.textAlign = "center";
  wheelCtx.fillText("SPIN", 0, 6);
  wheelCtx.restore();
}

// ─── Wheel Spin ───────────────────────────────────────────────────────────────
async function spinWheel() {
  if (wheelSpinning) return;

  const eligible = getEligibleAttendees();
  const winnerBox = document.getElementById("winnerBox");
  const spinWheelBtn = document.getElementById("spinWheelBtn");
  const removeWinnerToggle = document.getElementById("removeWinnerToggle");

  if (!eligible.length) {
    winnerBox.textContent = "Không có ai trong pool quay. Vào trang admin để thêm hoặc mở lại danh sách.";
    return;
  }

  wheelSpinning = true;
  spinWheelBtn.disabled = true;

  try {
    const result = await apiFetch("/api/turns/spin", {
      method: "POST",
      body: JSON.stringify({ autoExclude: removeWinnerToggle.checked }),
    });

    const { winner, winnerIndex, eligible: serverPool } = result;
    const pool = serverPool;
    const n = pool.length;

    // Calculate the exact animation endpoint so the winner lands at the top pointer
    const sliceAngle = (Math.PI * 2) / n;
    const targetNormalized = winnerIndex * sliceAngle + sliceAngle / 2;
    const targetRotationBase = Math.PI * 1.5 - targetNormalized;
    const extraTurns = 5 + Math.random() * 3;
    // Compute delta to reach targetRotationBase from currentRotation after extra full turns
    const currentMod = ((currentRotation % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const baseMod = ((targetRotationBase % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const angleDiff = ((baseMod - currentMod) + Math.PI * 2) % (Math.PI * 2);
    const endRotation = currentRotation + extraTurns * Math.PI * 2 + angleDiff;

    const startRotation = currentRotation;
    const duration = 4200;
    const startTime = performance.now();

    function animate(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - (1 - progress) ** 4;
      currentRotation = startRotation + (endRotation - startRotation) * eased;
      drawWheel(currentRotation, pool);

      if (progress < 1) {
        requestAnimationFrame(animate);
        return;
      }

      // Animation finished
      winnerBox.innerHTML = `<strong>${escapeHtml(winner.name)}</strong>Người may mắn vừa được chọn từ vòng quay.`;
      wheelSpinning = false;
      spinWheelBtn.disabled = false;
      // State update (excluded flag) arrives via WebSocket broadcast
    }

    requestAnimationFrame(animate);
  } catch (err) {
    console.error("Spin thất bại:", err);
    winnerBox.textContent = `Lỗi: ${err.message}`;
    wheelSpinning = false;
    spinWheelBtn.disabled = false;
  }
}

async function resetExcluded() {
  try {
    await apiFetch("/api/attendees/reset-excluded", { method: "POST" });
    const winnerBox = document.getElementById("winnerBox");
    if (winnerBox) winnerBox.textContent = "Tất cả người tham dự đã được mở lại vào pool quay.";
    // State will arrive via WebSocket broadcast
  } catch (err) {
    console.error("Reset thất bại:", err);
  }
}

// ─── Player Join Modal ────────────────────────────────────────────────────────
function setupPlayerModal() {
  const joinBtn = document.getElementById("playerJoinBtn");
  const modal = document.getElementById("playerModal");
  const closeBtn = document.getElementById("playerModalClose");
  const form = document.getElementById("playerJoinForm");
  const phoneInput = document.getElementById("playerPhoneInput");
  const nameInput = document.getElementById("playerNameInput");
  const statusEl = document.getElementById("playerJoinStatus");

  if (!joinBtn || !modal) return;

  if (!playerSession) {
    modal.classList.add("is-open", "is-required");
    if (closeBtn) closeBtn.classList.add("hidden");
  } else {
    updateJoinButton();
  }

  joinBtn.addEventListener("click", () => {
    modal.classList.add("is-open");
    phoneInput?.focus();
  });

  closeBtn?.addEventListener("click", () => modal.classList.remove("is-open"));

  modal.addEventListener("click", (e) => {
    if (e.target === modal && !modal.classList.contains("is-required")) {
      modal.classList.remove("is-open");
    }
  });

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const phone = phoneInput.value.trim();
    const name = nameInput.value.trim();
    if (!phone) return;

    joinBtn.disabled = true;
    statusEl.textContent = "Đang lưu...";

    try {
      const player = await apiFetch("/api/players/join", {
        method: "POST",
        body: JSON.stringify({ phone, name }),
      });
      playerSession = player;
      localStorage.setItem("reunion-player-session", JSON.stringify(player));
      statusEl.textContent = `✅ Chào ${player.name || player.phone}!`;
      updateJoinButton();
      modal.classList.remove("is-required");
      if (closeBtn) closeBtn.classList.remove("hidden");
      renderAll();
      setTimeout(() => modal.classList.remove("is-open"), 1500);
    } catch (err) {
      statusEl.textContent = `Lỗi: ${err.message}`;
    } finally {
      joinBtn.disabled = false;
    }
  });
}

function updateJoinButton() {
  const joinBtn = document.getElementById("playerJoinBtn");
  if (!joinBtn || !playerSession) return;
  const label = playerSession.name || playerSession.phone;
  if (joinBtn.textContent !== label) {
    joinBtn.textContent = label;
  }
}

// ─── Event Wiring ─────────────────────────────────────────────────────────────
function renderAll() {
  renderPublicTabs();
  if (activePublicTab === "wheel") {
    drawWheel();
  }
}

document.addEventListener("click", (event) => {
  const tabTarget = event.target.closest("[data-tab-target]");
  if (tabTarget) {
    activePublicTab = tabTarget.dataset.tabTarget;
    renderAll();
    return;
  }

  const spinBtn = event.target.closest("#spinWheelBtn");
  if (spinBtn) {
    spinWheel();
    return;
  }

  const resetBtn = event.target.closest("#resetWinnersBtn");
  if (resetBtn) {
    resetExcluded();
    return;
  }

  const gateBtn = event.target.closest("#gateJoinBtn");
  if (gateBtn) {
    const modal = document.getElementById("playerModal");
    if (modal) {
      modal.classList.add("is-open");
      const phoneInput = document.getElementById("playerPhoneInput");
      phoneInput?.focus();
    }
    return;
  }
});

// ─── Init ─────────────────────────────────────────────────────────────────────
(async () => {
  const saved = localStorage.getItem("reunion-player-session");
  if (saved) {
    try { playerSession = JSON.parse(saved); } catch { localStorage.removeItem("reunion-player-session"); }
  }
  await fetchState();
  renderAll();
  connectWebSocket();
  setupPlayerModal();
})();
