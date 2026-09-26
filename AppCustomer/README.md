# Hướng Dẫn Chạy AppCustomer (Khách Hàng)

Dự án này là ứng dụng di động dành cho khách hàng của hệ thống DeliveryFood, được xây dựng bằng React Native (Expo).

## 1. Yêu cầu trước khi chạy
- Máy tính đã cài đặt **Node.js** (Khuyến nghị bản LTS mới nhất).
- Đã cài đặt ứng dụng **Expo Go** trên điện thoại (tải từ App Store / Google Play).
- Điện thoại (hoặc máy ảo) và Máy tính phải được **kết nối cùng một mạng Wi-Fi** (rất quan trọng để gọi API nội bộ).
- Backend (Spring Boot) đang chạy ở cổng `8080`.

## 2. Cài đặt các thư viện (Lần đầu tiên)
Nếu đây là lần đầu tiên bạn chạy dự án này trên máy, hãy tải các thư viện node_modules:
```bash
npm install
```
*(Chỉ cần làm một lần, hoặc khi có thư viện mới).*

## 3. Cập nhật IP Máy chủ (Rất Quan Trọng)
Ứng dụng trên điện thoại không thể gọi API đến `localhost` của máy tính. Nó phải gọi thông qua **địa chỉ IP mạng LAN** của máy tính (ví dụ: `192.168.1.x`).
Dự án đã có sẵn file script tự động lấy IP máy tính và ghi vào các file cần thiết.

Hãy chạy lệnh này ở terminal (trong thư mục `AppCustomer`):
```bash
node update-ip.js
```
*Lệnh này sẽ tự động thay đổi `LOCAL_IP` trong `.env` và đổi url trong `apiClient.js` sang IP đúng của máy.*

> **Lưu ý**: Mỗi khi bạn thay đổi mạng Wi-Fi, máy tính sẽ được cấp IP khác. Bạn cần chạy lại `node update-ip.js` và khởi động lại ứng dụng Expo!

## 4. Khởi động ứng dụng (Expo)
Sau khi cập nhật IP thành công, hãy chạy ứng dụng:
```bash
npx expo start
```
(Hoặc có thể dùng `npm start` nếu máy có config sẵn).

## 5. Mở ứng dụng trên điện thoại
Khi lệnh `npx expo start` chạy xong, terminal sẽ hiện ra một cái **Mã QR**.
- **Trên iPhone (iOS)**: Mở ứng dụng Camera mặc định, quét mã QR này và mở bằng Expo Go.
- **Trên Android**: Mở ứng dụng **Expo Go**, chọn "Scan QR Code" và quét mã trên màn hình.

---

### Các Vấn Đề Thường Gặp (Troubleshooting)
1. **Network Error / Lỗi không gọi được API / App bị đứng khi Login**: 
   - Kiểm tra xem điện thoại có dùng đúng cục phát Wi-Fi với máy tính không. (Không dùng 3G/4G).
   - Bạn đã chạy `node update-ip.js` chưa?
   - Máy tính có bật Firewall chặn cổng 8080 không?

2. **Lỗi `WebSocket connection to 'ws://...' failed`**:
   - Đảm bảo Backend (Spring Boot) không chỉ chạy mà còn cho phép kết nối từ bên ngoài (IP LAN). Thông thường Spring Boot mở port 8080 trên `0.0.0.0` là ổn định.
   - Kiểm tra log trên điện thoại hoặc terminal xem kết nối bị chặn hay bị lỗi gì.

3. **Giao diện không cập nhật (cache)**:
   - Trong terminal đang chạy `npx expo start`, bạn có thể bấm phím `r` để reload app. Bấm phím `shift + R` (hoặc `R` in hoa) để clear cache bundle.