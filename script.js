const STORAGE_KEY = "reunion-games-admin-state-v1";

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

const teamIdeas = [
  {
    name: "Đội Ánh Sao",
    description: "Hợp với những người nói chuyện duyên và sẵn sàng mở màn không khí.",
  },
  {
    name: "Đội Thanh Xuân",
    description: "Tập hợp các thành viên có nhiều kỷ niệm và dễ khui lại chuyện cũ.",
  },
  {
    name: "Đội Hồi Ức",
    description: "Đội hợp với những người giữ ảnh cũ, biết nhiều chuyện hậu trường của lớp.",
  },
  {
    name: "Đội Bứt Phá",
    description: "Dành cho những gương mặt sân khấu, hay xung phong và biết tạo bất ngờ.",
  },
  {
    name: "Đội Kết Nối",
    description: "Nên ghép những bạn ít gặp nhau để tăng cơ hội trò chuyện mới.",
  },
  {
    name: "Đội Quay Về",
    description: "Phù hợp nhóm đi từ xa về tham dự, để tạo điểm nhấn cảm xúc.",
  },
];

const palette = ["#c76431", "#dd8b52", "#efb168", "#ad4e2d", "#e48d78", "#f2c38b", "#9d6b4a", "#7f4732"];

let state = loadState();
let currentRotation = 0;
let wheelSpinning = false;
let wheelPoolSnapshot = [];

const tabButtons = document.querySelectorAll("[data-tab-target]");
const tabPanels = document.querySelectorAll("[data-tab-panel]");
const publicGamesGrid = document.getElementById("publicGamesGrid");
const bingoStandaloneGrid = document.getElementById("bingoStandaloneGrid");
const bingoGameObjective = document.getElementById("bingoGameObjective");
const bingoDurationTag = document.getElementById("bingoDurationTag");
const eligibleList = document.getElementById("eligibleList");
const teamGrid = document.getElementById("teamGrid");
const shuffleTeamsBtn = document.getElementById("shuffleTeamsBtn");
const eligibleCountLabel = document.getElementById("eligibleCountLabel");
const summaryGames = document.getElementById("summaryGames");
const summaryAttendees = document.getElementById("summaryAttendees");
const summaryDuration = document.getElementById("summaryDuration");
const spinWheelBtn = document.getElementById("spinWheelBtn");
const resetWinnersBtn = document.getElementById("resetWinnersBtn");
const removeWinnerToggle = document.getElementById("removeWinnerToggle");
const winnerBox = document.getElementById("winnerBox");
const wheelCanvas = document.getElementById("wheelCanvas");
const wheelCtx = wheelCanvas.getContext("2d");

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

function revealOnScroll() {
  const revealItems = document.querySelectorAll(".section, .hero-card, .game-card, .panel");
  revealItems.forEach((item) => item.classList.add("reveal"));

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
        }
      });
    },
    { threshold: 0.12 }
  );

  revealItems.forEach((item) => observer.observe(item));
}

function shuffleArray(items) {
  const list = [...items];
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

function setActiveTab(target) {
  tabButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.tabTarget === target);
  });

  tabPanels.forEach((panel) => {
    panel.classList.toggle("is-active", panel.dataset.tabPanel === target);
  });
}

function renderTeams() {
  const selection = shuffleArray(teamIdeas).slice(0, 4);
  teamGrid.innerHTML = selection
    .map(
      (team) => `
        <div class="team-card reveal is-visible">
          <h3>${team.name}</h3>
          <p>${team.description}</p>
        </div>
      `
    )
    .join("");
}

function renderSummaries() {
  const activeGames = state.games.filter((game) => game.enabled);
  const totalDuration = activeGames.reduce((sum, game) => sum + Number(game.duration || 0), 0);
  summaryGames.textContent = String(activeGames.length);
  summaryAttendees.textContent = String(state.attendees.length);
  summaryDuration.textContent = `${totalDuration} phút`;
  const eligibleCount = state.attendees.filter((attendee) => !attendee.excluded).length;
  eligibleCountLabel.textContent = `${eligibleCount} người sẵn sàng`;
}

function renderBingoPreview(items) {
  if (!items?.length) {
    return `<div class="empty-state">Chưa có ô bingo nào. Vào trang admin để thêm nội dung.</div>`;
  }

  return `
    <div class="bingo-preview">
      ${items.map((item) => `<div class="bingo-cell">${escapeHtml(item)}</div>`).join("")}
    </div>
  `;
}

function renderPublicGames() {
  const activeGames = state.games.filter((game) => game.enabled && game.id !== "bingo");
  if (!activeGames.length) {
    publicGamesGrid.innerHTML = `<div class="empty-state">Chưa có game nào ngoài Bingo đang bật. Vào trang admin để kích hoạt thêm game.</div>`;
    return;
  }

  publicGamesGrid.innerHTML = activeGames
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
        </article>
      `
    )
    .join("");
}

function renderBingoTab() {
  const bingoGame = state.games.find((game) => game.id === "bingo");
  if (!bingoGame || !bingoGame.enabled) {
    bingoGameObjective.textContent = "Game Bingo hiện đang tắt. Vào trang admin để bật lại hoặc cập nhật nội dung.";
    bingoDurationTag.textContent = "0 phút";
    bingoStandaloneGrid.innerHTML = `<div class="empty-state">Chưa có dữ liệu bingo để hiển thị.</div>`;
    return;
  }

  bingoGameObjective.textContent = bingoGame.objective;
  bingoDurationTag.textContent = `${bingoGame.duration} phút`;
  bingoStandaloneGrid.innerHTML = renderBingoPreview(bingoGame.bingoItems);
}

function renderEligibleList() {
  const eligible = state.attendees.filter((attendee) => !attendee.excluded);
  eligibleList.innerHTML = eligible.length
    ? eligible
        .map(
          (attendee) => `
            <div class="attendee-item">
              <div>
                <div class="attendee-name">${attendee.name}</div>
                <div class="attendee-status">Sẵn sàng tham gia vòng quay</div>
              </div>
            </div>
          `
        )
        .join("")
    : `<div class="empty-state">Không còn ai trong pool quay. Vào trang admin để mở lại danh sách.</div>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderAll() {
  renderSummaries();
  renderPublicGames();
  renderBingoTab();
  renderEligibleList();
  drawWheel();
}

function resetExcluded() {
  state.attendees = state.attendees.map((attendee) => ({ ...attendee, excluded: false }));
  saveState();
  winnerBox.textContent = "Tất cả người tham dự đã được mở lại vào pool quay.";
  renderAll();
}

function getEligibleAttendees() {
  return state.attendees.filter((attendee) => !attendee.excluded);
}

function drawWheel(rotation = currentRotation, pool = getEligibleAttendees()) {
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

function getWinnerFromRotation(rotation, pool) {
  const sliceAngle = (Math.PI * 2) / pool.length;
  const normalized = ((Math.PI * 1.5 - rotation) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
  const index = Math.floor(normalized / sliceAngle) % pool.length;
  return pool[index];
}

function spinWheel() {
  if (wheelSpinning) {
    return;
  }

  const eligible = getEligibleAttendees();
  if (!eligible.length) {
    winnerBox.textContent = "Không có ai trong pool quay. Vào trang admin để thêm hoặc mở lại danh sách.";
    return;
  }

  wheelSpinning = true;
  wheelPoolSnapshot = eligible;
  spinWheelBtn.disabled = true;

  const extraTurns = 5 + Math.random() * 3;
  const randomOffset = Math.random() * Math.PI * 2;
  const startRotation = currentRotation;
  const endRotation = currentRotation + extraTurns * Math.PI * 2 + randomOffset;
  const duration = 4200;
  const startTime = performance.now();

  function animate(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - (1 - progress) ** 4;
    currentRotation = startRotation + (endRotation - startRotation) * eased;
    drawWheel(currentRotation, wheelPoolSnapshot);

    if (progress < 1) {
      requestAnimationFrame(animate);
      return;
    }

    const winner = getWinnerFromRotation(currentRotation, wheelPoolSnapshot);
    if (winner) {
      winnerBox.innerHTML = `<strong>${winner.name}</strong>Người may mắn vừa được chọn từ vòng quay.`;

      if (removeWinnerToggle.checked) {
        const attendee = state.attendees.find((item) => item.id === winner.id);
        if (attendee) {
          attendee.excluded = true;
          saveState();
        }
      }
    }

    wheelSpinning = false;
    spinWheelBtn.disabled = false;
    renderAll();
  }

  requestAnimationFrame(animate);
}

document.addEventListener("click", (event) => {
  const tabTarget = event.target.closest("[data-tab-target]");
  if (tabTarget) {
    setActiveTab(tabTarget.dataset.tabTarget);
  }
});

resetWinnersBtn.addEventListener("click", resetExcluded);
shuffleTeamsBtn.addEventListener("click", renderTeams);
spinWheelBtn.addEventListener("click", spinWheel);

renderTeams();
renderAll();
revealOnScroll();
