// ─── State ───────────────────────────────────────────────────────────────────
let state = { games: [], attendees: [] };
let currentRotation = 0;
let wheelSpinning = false;
let activePublicTab = "wheel";
let playerSession = null; // { phone, name, id }
let ws = null;

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

// ─── API Helpers ──────────────────────────────────────────────────────────────
async function apiFetch(path, options = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Network error" }));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
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
function connectWebSocket() {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  ws = new WebSocket(`${protocol}//${location.host}/ws`);

  ws.addEventListener("message", (event) => {
    try {
      const { event: evtName, data } = JSON.parse(event.data);
      if (evtName === "state_update") {
        if (Array.isArray(data.games)) state.games = data.games;
        if (Array.isArray(data.attendees)) state.attendees = data.attendees;
        renderAll();
      } else if (evtName === "wheel_result" && !wheelSpinning) {
        // Another device triggered spin — show result on this screen
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
    ws = null;
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

function renderBingoPreview(items) {
  if (!items?.length) {
    return `<div class="empty-state">Chưa có ô bingo nào. Ban tổ chức cần cập nhật từ trang admin.</div>`;
  }
  return `
    <div class="bingo-preview">
      ${items.map((item) => `<div class="bingo-cell">${escapeHtml(item)}</div>`).join("")}
    </div>
  `;
}

function renderGamePanel(game) {
  if (game.id === "bingo") {
    return `
      <section class="tab-panel ${activePublicTab === game.id ? "is-active" : ""}" data-tab-panel="${game.id}">
        <section class="section split-section">
          <div class="panel">
            <div class="section-heading compact">
              <p class="eyebrow">Bingo riêng</p>
              <h2>${escapeHtml(game.title)}</h2>
            </div>
            <p>${escapeHtml(game.objective)}</p>
            <div class="inline-actions">
              <span class="tag">${game.duration} phút</span>
            </div>
            ${renderBingoPreview(game.bingoItems)}
          </div>

          <div class="panel">
            <div class="section-heading compact">
              <p class="eyebrow">Cách chơi</p>
              <h2>Gợi ý triển khai</h2>
            </div>
            <ul class="checklist">
              <li>Mỗi người nhận 1 phiếu bingo với các ô ký ức khác nhau.</li>
              <li>Người chơi đi tìm bạn phù hợp với từng ô và xin xác nhận.</li>
              <li>Ai hoàn thành một hàng ngang, dọc hoặc chéo trước sẽ hô "Bingo".</li>
              <li>Nội dung ô bingo được ban tổ chức cập nhật từ trang admin riêng.</li>
              <li>Nên chọn ô đủ vui nhưng không quá riêng tư để ai cũng dễ tham gia.</li>
            </ul>
          </div>
        </section>
      </section>
    `;
  }

  return `
    <section class="tab-panel ${activePublicTab === game.id ? "is-active" : ""}" data-tab-panel="${game.id}">
      <section class="section split-section">
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

        <div class="panel">
          <div class="section-heading compact">
            <p class="eyebrow">Gợi ý vận hành</p>
            <h2>Cách dùng trong buổi họp lớp</h2>
          </div>
          <ul class="checklist">
            <li>MC giới thiệu nhanh luật chơi trước khi bắt đầu.</li>
            <li>Cho người chơi 30-60 giây để hiểu rõ mục tiêu và cách tính thắng.</li>
            <li>Chuẩn bị sẵn đạo cụ và người hỗ trợ để tránh ngắt mạch chương trình.</li>
            <li>Nếu số lượng người thay đổi, ban tổ chức có thể cập nhật lại trong trang admin.</li>
          </ul>
        </div>
      </section>
    </section>
  `;
}

function renderWheelPanel() {
  const eligibleCount = getEligibleAttendees().length;

  return `
    <section class="tab-panel ${activePublicTab === "wheel" ? "is-active" : ""}" data-tab-panel="wheel">
      <section class="section split-section wheel-layout">
        <div class="panel wheel-panel">
          <div class="section-heading compact">
            <p class="eyebrow">Lucky wheel</p>
            <h2>Vòng quay may mắn</h2>
          </div>
          <p>Lấy dữ liệu từ danh sách tham dự trong trang admin. Có thể loại người đã trúng để tránh lặp lại.</p>
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

        <div class="panel">
          <div class="section-heading compact">
            <p class="eyebrow">Trạng thái pool</p>
            <h2>Danh sách đang tham gia vòng quay</h2>
          </div>
          <div class="admin-subhead">
            <strong>Pool hợp lệ</strong>
            <span id="eligibleCountLabel">${eligibleCount} người sẵn sàng</span>
          </div>
          <div class="attendee-list" id="eligibleList"></div>
        </div>
      </section>
    </section>
  `;
}

function renderPublicTabs() {
  const enabledGames = getEnabledGames();

  if (!enabledGames.some((g) => g.id === activePublicTab) && activePublicTab !== "wheel") {
    activePublicTab = enabledGames[0]?.id ?? "wheel";
  }

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
    .concat(
      `<button class="button button-secondary" type="button" data-tab-target="wheel">Vòng quay</button>`
    )
    .join("");

  publicTabStrip.innerHTML = enabledGames
    .map(
      (game) => `
        <button class="tab-chip ${activePublicTab === game.id ? "is-active" : ""}" type="button" data-tab-target="${game.id}">
          ${escapeHtml(game.title)}
        </button>
      `
    )
    .concat(
      `<button class="tab-chip ${activePublicTab === "wheel" ? "is-active" : ""}" type="button" data-tab-target="wheel">Vòng quay may mắn</button>`
    )
    .join("");

  publicPanels.innerHTML = enabledGames.map(renderGamePanel).join("") + renderWheelPanel();
}

function renderEligibleList() {
  const eligibleList = document.getElementById("eligibleList");
  const eligibleCountLabel = document.getElementById("eligibleCountLabel");
  if (!eligibleList || !eligibleCountLabel) return;

  const eligible = getEligibleAttendees();
  eligibleCountLabel.textContent = `${eligible.length} người sẵn sàng`;
  eligibleList.innerHTML = eligible.length
    ? eligible
        .map(
          (a) => `
            <div class="attendee-item">
              <div>
                <div class="attendee-name">${escapeHtml(a.name)}</div>
                <div class="attendee-status">Sẵn sàng tham gia vòng quay</div>
              </div>
            </div>
          `
        )
        .join("")
    : `<div class="empty-state">Không còn ai trong pool quay. Vào trang admin để mở lại danh sách.</div>`;
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

  // Restore session
  const saved = sessionStorage.getItem("reunion-player-session");
  if (saved) {
    try {
      playerSession = JSON.parse(saved);
      updateJoinButton();
    } catch {
      sessionStorage.removeItem("reunion-player-session");
    }
  }

  joinBtn.addEventListener("click", () => {
    modal.classList.add("is-open");
    phoneInput?.focus();
  });

  closeBtn?.addEventListener("click", () => modal.classList.remove("is-open"));

  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.classList.remove("is-open");
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
      sessionStorage.setItem("reunion-player-session", JSON.stringify(player));
      statusEl.textContent = `✅ Chào ${player.name || player.phone}!`;
      updateJoinButton();
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
  joinBtn.textContent = playerSession.name || playerSession.phone;
}

// ─── Event Wiring ─────────────────────────────────────────────────────────────
function wireDynamicEvents() {
  const spinWheelBtn = document.getElementById("spinWheelBtn");
  const resetWinnersBtn = document.getElementById("resetWinnersBtn");
  if (spinWheelBtn) spinWheelBtn.addEventListener("click", spinWheel);
  if (resetWinnersBtn) resetWinnersBtn.addEventListener("click", resetExcluded);
}

function renderAll() {
  renderPublicTabs();
  renderEligibleList();
  drawWheel();
  wireDynamicEvents();
}

document.addEventListener("click", (event) => {
  const tabTarget = event.target.closest("[data-tab-target]");
  if (!tabTarget) return;
  activePublicTab = tabTarget.dataset.tabTarget;
  renderAll();
});

// ─── Init ─────────────────────────────────────────────────────────────────────
(async () => {
  await fetchState();
  renderAll();
  connectWebSocket();
  setupPlayerModal();
})();
