# Reunion Games GitHub Pages

Microsite HTML tĩnh để tổ chức họp lớp kỷ niệm 10 năm ra trường, bao gồm:

- Trang tổng quan chương trình và danh sách game
- Tab admin để cấu hình từng game
- Quản lý danh sách người tham dự
- Vòng quay may mắn dùng chung dữ liệu người tham dự

## Nội dung admin

- Bật tắt game
- Sửa tên game, thời lượng, mục tiêu, đạo cụ, ghi chú
- Thêm nhanh người tham dự
- Import nhanh từ danh sách text
- Xóa tất cả danh sách
- Ẩn người đã trúng khỏi pool quay và mở lại khi cần

## Cách chạy local

Mở file `index.html` trong trình duyệt.

## Deploy lên GitHub Pages

1. Tạo repository mới trên GitHub.
2. Đẩy toàn bộ nội dung thư mục này lên branch `main`.
3. Vào `Settings` > `Pages`.
4. Chọn deploy từ branch `main`, folder `/root`.
5. Lưu lại và đợi GitHub Pages build xong.

## Ghi chú

Dữ liệu được lưu bằng `localStorage`, vì vậy mỗi trình duyệt sẽ có bộ dữ liệu riêng.
