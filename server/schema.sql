-- Bật extension UUID nếu chưa có
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Người chơi: nhập SĐT, không cần OTP/verify
CREATE TABLE IF NOT EXISTS players (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone       TEXT NOT NULL UNIQUE,
  name        TEXT,
  fingerprint TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Tài khoản admin (username + bcrypt hash)
CREATE TABLE IF NOT EXISTS admin_users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username        TEXT NOT NULL UNIQUE,
  password_hash   TEXT NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Cấu hình game — thiết kế chung cho mọi loại game
CREATE TABLE IF NOT EXISTS games (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  duration    INT DEFAULT 15,
  enabled     BOOLEAN DEFAULT true,
  objective   TEXT DEFAULT '',
  supplies    TEXT DEFAULT '',
  notes       TEXT DEFAULT '',
  extra       JSONB DEFAULT '{}',  -- bingo_items, wheel_config, ...
  sort_order  INT DEFAULT 0,
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- Người tham dự vòng quay (tên nhập tay hoặc liên kết player)
CREATE TABLE IF NOT EXISTS attendees (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id   UUID REFERENCES players(id) ON DELETE SET NULL,
  name        TEXT NOT NULL,
  excluded    BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Lượt chơi chung — wheel_spin, bingo_winner, image_answer, ...
CREATE TABLE IF NOT EXISTS game_turns (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id         TEXT NOT NULL REFERENCES games(id),
  turn_type       TEXT NOT NULL,
  player_id       UUID REFERENCES players(id) ON DELETE SET NULL,
  attendee_id     UUID REFERENCES attendees(id) ON DELETE SET NULL,
  result          JSONB DEFAULT '{}',
  triggered_by    UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_game_turns_game ON game_turns (game_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_game_turns_player ON game_turns (player_id);
CREATE INDEX IF NOT EXISTS idx_attendees_excluded ON attendees (excluded);

-- Seed games mặc định
INSERT INTO games (id, title, duration, enabled, objective, supplies, notes, extra, sort_order) VALUES
  ('bingo', 'Bingo Ký Ức Lớp Mình', 12, true,
    'Phá băng và kéo mọi người bắt chuyện ngay từ đầu buổi.',
    'Phiếu bingo, bút, sticker check-in.',
    'Nên đặt 12-16 ô có nội dung liên quan kỷ niệm của lớp.',
    '{"bingoItems":["Từng ngồi bàn cuối","Hay ngủ gật trong giờ","Từng bị ghi sổ đầu bài","Lần đầu đi họp lớp sau 10 năm","Từng làm lớp phó","Hay đi học muộn","Có ảnh kỷ yếu siêu hài","Từng trốn tiết thành công","Hay bị gọi lên bảng","Từng tham gia văn nghệ","Từng trực nhật cùng bạn","Từng mượn bài chép gấp"]}',
    0),
  ('image', 'Đuổi Hình Bắt Kỷ Niệm', 15, true,
    'Gợi lại chuyện cũ thông qua ảnh lớp, sự kiện và nhân vật quen thuộc.',
    'Slide ảnh, màn chiếu, chuông hoặc bảng đáp án.',
    'Có thể dùng ảnh crop một phần để tăng độ khó.',
    '{}', 1),
  ('memory', 'Ai Là Chủ Nhân Kỷ Niệm Này', 20, true,
    'Làm nổi bật từng thành viên bằng các mẩu chuyện ẩn danh vui.',
    'Form thu kỷ niệm, micro, màn chiếu.',
    'Thu kỷ niệm trước ngày tổ chức 3-5 ngày.',
    '{}', 2),
  ('relay', 'Truyền Tin Phiên Bản 10 Năm Sau', 15, true,
    'Tạo tiếng cười qua việc truyền sai thông điệp giữa các thành viên.',
    'Giấy, bút, bộ câu nói ngắn.',
    'Nhớ chọn nội dung vui, gọn, dễ nghe nhầm.',
    '{}', 3),
  ('tower', 'Xây Tháp Cam Kết', 18, true,
    'Kết thúc vui cho chương trình và khuyến khích mọi người gửi lời chúc.',
    'Ly giấy, dây, bảng điểm.',
    'Mỗi lượt đặt ly cần nói một điều tốt đẹp cho lần gặp sau.',
    '{}', 4),
  ('wheel', 'Vòng Quay May Mắn', 10, true,
    'Chọn ngẫu nhiên người may mắn từ danh sách tham dự.',
    'Màn hình hiển thị vòng quay.',
    'Có thể ẩn người đã trúng để không bị lặp.',
    '{}', 5)
ON CONFLICT (id) DO NOTHING;
