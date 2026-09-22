# Luồng Hoạt Động Của Shipper, Khách Hàng và Shop

Tài liệu này mô tả chi tiết luồng nghiệp vụ giao nhận thức ăn giữa 3 chủ thể: **Khách Hàng (Customer)**, **Nhà Hàng/Quán Ăn (Shop)**, và **Tài Xế (Shipper)**.

---

## 1. Khách Hàng Đặt Đơn (Customer)
- Khách hàng đăng nhập vào ứng dụng Web (hoặc App) dành cho Customer.
- Khách hàng lướt xem các gian hàng, chọn món và thêm vào giỏ hàng.
- Khách hàng tiến hành **Thanh toán (Checkout)**:
  - Chọn địa chỉ giao hàng.
  - Chọn phương thức thanh toán (Tiền mặt / VNPay).
- Hệ thống tạo đơn hàng với trạng thái ban đầu là `PLACED` (Đã đặt hàng).
- **Socket/Notification**: Quán ăn (Shop) sẽ nhận được thông báo có đơn đặt hàng mới theo thời gian thực (Real-time).

---

## 2. Quán Ăn Xác Nhận & Chuẩn Bị (Shop)
- Quán ăn truy cập vào **Portal Shop Manager** (Ứng dụng quản lý của quán).
- Nhìn thấy đơn hàng mới ở trạng thái `PLACED`, nhân viên quán kiểm tra nguyên liệu và bấm **Xác nhận (Accept)**.
  - Trạng thái đơn hàng chuyển thành `CONFIRMED` (Đã xác nhận).
- Quán bắt đầu làm món, lúc này trạng thái là `PREPARING` (Đang chuẩn bị).
- Sau khi nấu xong và đóng gói, quán bấm nút **Sẵn sàng giao (Ready for Pickup)**.
  - Trạng thái đơn hàng chuyển thành `READY_FOR_PICKUP`.
  - Hệ thống tự động đẩy thông tin đơn hàng lên hệ thống tìm kiếm Shipper (Kafka/Tracking Service).

---

## 3. Shipper Nhận Đơn (Shipper)
- Tài xế (Shipper) mở **AppShipper (Mobile App)** và bật chế độ **Trực tuyến (Online)**.
- Khi có đơn hàng `READY_FOR_PICKUP` (hoặc `PREPARING` chuẩn bị xong) gần vị trí của Shipper, hệ thống sẽ **Phát đơn (Broadcast)**.
- Màn hình Shipper hiển thị thông báo có đơn mới kèm theo: Khoảng cách, Tiền ship, Tên quán, Điểm giao.
- Nếu Shipper bấm **Nhận đơn (Accept)**:
  - Trạng thái đơn hàng chuyển thành `ASSIGNED` (Đã có tài xế).
  - Hệ thống ghi nhận `shipperId` vào đơn hàng.
  - Khách hàng có thể bắt đầu **theo dõi định vị** tài xế trên bản đồ ở trang *Tra cứu đơn* hoặc *Chi tiết đơn*.

---

## 4. Quá Trình Giao Hàng (Shipper & Customer)
- **Đến quán lấy hàng:**
  - Shipper chạy xe đến vị trí của Shop (Điểm A).
  - Khi đến nơi và lấy được thức ăn từ tay quán, Shipper vuốt/bấm nút **Đã lấy hàng (Picked Up)**.
  - Trạng thái đơn hàng chuyển thành `DELIVERING` (Đang giao hàng).
- **Trên đường giao:**
  - Ứng dụng AppShipper liên tục gửi toạ độ GPS của tài xế lên server (qua WebSockets hoặc API).
  - Khách hàng mở trang chi tiết đơn sẽ thấy icon xe máy của Shipper di chuyển theo thời gian thực trên bản đồ (Google Maps/Vietmap).
- **Giao đến nơi:**
  - Shipper chạy xe đến vị trí của Khách hàng (Điểm B).
  - Gặp khách, thu tiền (nếu là COD).
  - Shipper bấm nút **Hoàn thành giao hàng (Delivered)**.
  - Trạng thái đơn hàng chuyển thành `DELIVERED` (Giao hàng thành công).

---

## 5. Đối Soát & Kết Thúc (Admin, Shop, Shipper)
- Hệ thống Backend (Order Service) xử lý tính toán hoa hồng (Commission) cho Shop dựa trên Cấu Hình Hoa Hồng.
- Hệ thống tính toán Tiền công (Phí ship) cộng vào ví của Shipper.
- Đơn hàng chuyển sang trạng thái cuối cùng là `COMPLETED`.
- Khách hàng nhận được thông báo Đánh giá đơn hàng. Khách có thể **Đánh giá quán (Shop Rating)** và **Đánh giá tài xế (Shipper Rating)**.

---

## Tóm tắt vòng đời trạng thái Đơn Hàng (Order Status)
1. \`PLACED\` ➔ Khách vừa đặt.
2. \`CONFIRMED\` ➔ Quán xác nhận.
3. \`PREPARING\` ➔ Quán đang làm món.
4. \`READY_FOR_PICKUP\` ➔ Đồ ăn đã nấu xong, chờ tài xế.
5. \`ASSIGNED\` ➔ Shipper đã nhận đơn, đang chạy đến quán.
6. \`DELIVERING\` ➔ Shipper đã lấy đồ ăn, đang chạy đến nhà khách.
7. \`DELIVERED\` ➔ Khách đã nhận đồ ăn.
8. \`COMPLETED\` ➔ Hoàn tất (Đã đối soát / Đánh giá).

*(Bất kỳ lúc nào trước khi nấu hoặc đang nấu, đơn có thể bị huỷ và chuyển sang trạng thái \`CANCELLED\`)*

---

## 🛠 Hướng Dẫn Cấu Hình Chạy Chéo Máy (Mạng LAN)

Khi bạn muốn chạy đồ án trên **nhiều máy khác nhau** (ví dụ: máy tính A chạy Backend, điện thoại B chạy AppShipper, máy tính C chạy Dashboard Admin), bạn **BẮT BUỘC phải cấu hình IP** thay vì dùng `localhost`.

Lý do: `localhost` trên điện thoại nghĩa là chính cái điện thoại đó chứ không phải laptop của bạn.

### Các bước thay đổi địa chỉ IP siêu nhanh:

1. **Kiểm tra 2 máy phải bắt chung 1 mạng Wi-Fi.**
2. **Lấy IP hiện tại của máy chạy Backend (Mac/Windows):**
   - Trên Mac: Mở Terminal gõ `ipconfig getifaddr en0` (sẽ ra dạng `192.168.x.x`).
   - Trên Windows: Mở CMD gõ `ipconfig` (tìm dòng IPv4 Address).
3. **Mở file cấu hình chung:** 
   Tại thư mục `AppShipper`, mở file `.env` lên. Sửa dòng `LOCAL_IP` thành IP của bạn:
   ```env
   LOCAL_IP=192.168.1.15
   ```
4. **Chạy Script Cập Nhật Tự Động:**
   Mở Terminal ở thư mục `AppShipper` và chạy lệnh sau (yêu cầu máy có cài Node.js):
   ```bash
   node update-ip.js
   ```
5. Kịch bản `update-ip.js` sẽ tự động quét và cập nhật lại toàn bộ đường dẫn API của Web Khách Hàng, Dashboard Admin, và Mobile App. 
6. Khởi động lại các project (`npm run dev` / `npx expo start`) là xong! Mọi máy trong mạng LAN đã có thể gọi API tới nhau bình thường.
