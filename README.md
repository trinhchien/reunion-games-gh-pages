# Reunion Games

Web application tổ chức họp lớp kỷ niệm 10 năm ra trường — có backend server, realtime WebSocket và cơ sở dữ liệu PostgreSQL.

## Tính năng

- Trang tổng quan chương trình và danh sách game (công khai)
- Trang admin có xác thực JWT để cấu hình từng game
- Quản lý danh sách người tham dự
- Vòng quay may mắn đồng bộ realtime qua WebSocket
- Người tham dự có thể đăng ký bằng số điện thoại
- Đồng bộ dữ liệu giữa nhiều thiết bị (trình chiếu + người dùng)

## Cấu trúc thư mục

```
├── public/                  # Static frontend files (served by server)
│   ├── index.html           # Trang công khai
│   ├── admin.html           # Trang quản trị
│   ├── style.css            # Styles
│   ├── script.js            # Frontend logic (public)
│   └── admin.js             # Frontend logic (admin)
├── server/                  # Backend
│   ├── index.ts             # Entry point (Hono + Bun)
│   ├── db.ts                # PostgreSQL connection
│   ├── schema.sql           # Database schema
│   ├── seed-admin.ts        # Seed admin user
│   ├── ws.ts                # WebSocket broadcast
│   ├── middleware/auth.ts   # JWT auth middleware
│   └── routes/              # API routes
│       ├── admin.ts
│       ├── games.ts
│       ├── players.ts
│       └── turns.ts
├── cloudflared/             # Cloudflare Tunnel config
└── docker-compose.yml       # PostgreSQL container
```

## Yêu cầu

- [Bun](https://bun.sh) 1.1+
- Docker (cho PostgreSQL)

## Cách chạy local

```bash
# 1. Khởi động PostgreSQL
docker compose up -d

# 2. Seed admin user (lần đầu)
bun run seed

# 3. Khởi động server
bun run dev
```

Server sẽ chạy tại `http://localhost:3000`.

### Biến môi trường

Tạo file `.env` trong thư mục gốc:

```env
DATABASE_URL=postgres://reunion:changeme@localhost:5432/reunion
JWT_SECRET=thay-doi-me-ket-nay
ADMIN_USERNAME=admin
ADMIN_PASSWORD=thay-doi-mat-khau
```

## Deploy

Sử dụng Cloudflare Tunnel (xem `cloudflared/config.yml`) hoặc deploy lên VPS bất kỳ với Bun.

## Công nghệ

- **Backend:** [Hono](https://hono.dev) + [Bun](https://bun.sh)
- **Database:** PostgreSQL 16
- **Auth:** JWT (jose) + bcryptjs
- **Realtime:** WebSocket (Hono Bun adapter)
- **Frontend:** Vanilla JS, DOM-driven
