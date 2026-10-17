# 📱 Food Delivery - Mobile Applications (React Native & Expo)

[![React Native](https://img.shields.io/badge/React%20Native-0.76+-61DAFB.svg)](https://reactnative.dev/)
[![Expo](https://img.shields.io/badge/Expo-SDK%2057-000020.svg)](https://expo.dev/)
[![React Navigation](https://img.shields.io/badge/React%20Navigation-v7-7B1FA2.svg)](https://reactnavigation.org/)
[![Lucide Icons](https://img.shields.io/badge/Lucide-Icons-F56565.svg)](https://lucide.dev/)
[![WebSocket](https://img.shields.io/badge/WebSocket-STOMP-010101.svg)](https://stomp.github.io/)

Kho mã nguồn ứng dụng di động đa nền tảng (**iOS & Android & Web**) dành cho hệ thống Giao Đồ Ăn, phát triển trên nền tảng **React Native** và **Expo SDK 57**.

Repository bao gồm hai ứng dụng độc lập:
1. **`AppCustomer`**: Ứng dụng dành cho **Khách hàng đặt món**.
2. **`AppShipper`**: Ứng dụng dành cho **Tài xế giao hàng công nghệ**.

---

## 📁 Cấu Trúc Thư Mục (Repository Structure)

```
DeliveryFood_Mobile/
├── AppCustomer/                 # Ứng dụng Khách Hàng (Port: 8089)
│   ├── src/
│   │   ├── screens/             # Màn hình: Đăng nhập, Trang chủ, Chi tiết quán, Giỏ hàng, Thanh toán, Theo dõi đơn, Hồ sơ
│   │   ├── components/          # Tùy chọn món (Topping/Option), Đánh giá 3 tiêu chí, Modal bản đồ
│   │   ├── context/             # Quản lý State: AuthContext, CartContext, SocketContext
│   │   ├── api/                 # Axios clients kết nối Backend Microservices qua Gateway
│   │   └── lib/                 # Tiện ích định dạng tiền VND, ngày giờ, WebSocket STOMP
│   ├── App.js                   # Navigation Container & Tab Bar
│   ├── package.json
│   └── .env                     # Cấu hình IP máy chủ Backend Gateway
│
└── AppShipper/                  # Ứng dụng Tài Xế Giao Hàng (Port: 8090)
    ├── src/
    │   ├── screens/             # Màn hình: Nhận cuốc xe, Lộ trình giao hàng, Chụp ảnh xác nhận, Lịch sử, Ví tiền COD
    │   ├── components/          # Chi tiết cuốc xe, Modal chi tiết đơn, Modal đối soát nộp COD 3D
    │   ├── context/             # ShipperContext (Trạng thái ca làm việc, tọa độ hiện tại)
    │   ├── lib/
    │   │   ├── backgroundLocation.js # Tác vụ định vị ngầm GPS liên tục gửi về Tracking Service
    │   │   └── apiClient.js     # Axios client kết nối Gateway
    ├── App.js                   # Navigation & Layout Responsive Web/Mobile
    ├── package.json
    └── .env                     # Cấu hình IP máy chủ Backend Gateway
```

---

## 🍔 1. AppCustomer - Ứng Dụng Khách Hàng

### ✨ Tính Năng Nổi Bật
- **Khám phá Quán ngon:** Danh mục phong phú, tìm kiếm theo tên món, tên quán hoặc lọc theo khoảng cách gần nhất.
- **Tùy biến món ăn linh hoạt:** Chọn kích cỡ (Size), mức đường/đá, thêm topping và ghi chú riêng cho từng món.
- **Giỏ hàng đơn quán & Giỏ ghép 2 quán:** Tự động tính toán tổng tiền, chiết khấu và tối ưu phí vận chuyển khi đặt chung 2 quán lân cận.
- **Thanh toán chuyển khoản VietQR tự động:**
  - Tạo mã QR ngân hàng chuẩn NAPAS kèm cú pháp giao dịch.
  - Tự động nhận diện thanh toán thành công tức thì qua webhook và chuyển sang màn hình chuẩn bị món.
- **Theo dõi đơn hàng thời gian thực:**
  - Cập nhật từng trạng thái: *Đang chờ quán xác nhận -> Đang chuẩn bị món -> Tài xế đã nhận đơn -> Đang lấy món -> Đang giao -> Hoàn thành*.
  - Hiển thị vị trí di chuyển của tài xế trực tiếp trên bản đồ.
- **Đánh giá đơn hàng toàn diện:** Cho phép khách hàng chấm sao và nhận xét chi tiết cả 3 đối tượng: **Tài xế**, **Quán ăn**, và **Từng món ăn**.

---

## 🛵 2. AppShipper - Ứng Dụng Tài Xế Giao Hàng

### ✨ Tính Năng Nổi Bật
- **Nhận & Bật/Tắt ca làm việc:** Trực quan hóa nút bật nhận đơn. Hệ thống tự động phân bổ cuốc xe tối ưu gần nhất cho shipper.
- **Hỗ trợ lộ trình đơn ghép 2 quán:**
  - Điều hướng thông minh theo từng chặng: *Điểm lấy quán 1 -> Điểm lấy quán 2 -> Điểm giao khách hàng*.
  - Hiển thị đầy đủ số điện thoại khách, địa chỉ và ghi chú giao hàng.
- **Định vị GPS nền (Background Location Service):** Tự động phát tọa độ GPS về `tracking-service` mỗi 5-10 giây ngay cả khi tắt màn hình hoặc chuyển app.
- **Chụp ảnh bằng chứng giao hàng (Proof of Delivery):** Chụp ảnh thực tế gói đồ ăn trao tay khách và tải lên hệ thống trước khi bấm hoàn tất đơn.
- **Quản lý Ví tiền & Đối soát COD:**
  - Theo dõi tổng số tiền mặt COD đang giữ của từng đơn.
  - Phân tách rõ ràng số tiền hoàn trả cho từng quán đối với đơn ghép 2 quán.
  - **Nộp hoàn trả COD tức thì (Nộp ngay):** Bấm nộp tiền thu hộ, hệ thống tự động đối soát và nạp tiền vào ví của các chủ quán tương ứng ngay lập tức.
  - Giao diện Modal 3D hiện đại, responsive mượt mà trên cả thiết bị di động lẫn trình duyệt Web máy tính.

---

## ⚙️ Cấu Hình Môi Trường (.env)

Cả hai ứng dụng đều kết nối tới Backend thông qua **Spring Cloud API Gateway (Port 8080)**.

Trong thư mục `AppCustomer/.env` và `AppShipper/.env`, cấu hình đường dẫn Gateway:

```env
# Nếu chạy qua Ngrok Tunnel (Khuyên dùng khi test trên điện thoại thật):
LOCAL_IP=unentwined-johanne-biasedly.ngrok-free.dev
GATEWAY_URL=https://unentwined-johanne-biasedly.ngrok-free.dev

# Hoặc nếu chạy mạng nội bộ LAN WiFi:
# LOCAL_IP=192.168.1.50:8080
# GATEWAY_URL=http://192.168.1.50:8080
```

---

## 🚀 Hướng Dẫn Cài Đặt & Khởi Chạy

### Khởi chạy Ứng dụng Khách Hàng (`AppCustomer` - Cổng 8089)

```bash
cd DeliveryFood_Mobile/AppCustomer

# 1. Cài đặt các thư viện
npm install

# 2. Khởi chạy với Expo:
# Mở giao diện Web trên máy tính:
npm run web

# Hoặc tạo đường hầm kết nối điện thoại thật (Expo Go qua Tunnel):
npm run tunnel
```

### Khởi chạy Ứng dụng Tài Xế (`AppShipper` - Cổng 8090)

```bash
cd DeliveryFood_Mobile/AppShipper

# 1. Cài đặt các thư viện
npm install

# 2. Khởi chạy với Expo:
# Mở giao diện Web trên máy tính:
npm run web

# Hoặc tạo đường hầm kết nối điện thoại thật (Expo Go qua Tunnel):
npm run tunnel
```

> **Mẹo (Tips) khi sử dụng Expo Go:**
> - Tải ứng dụng **Expo Go** từ App Store (iOS) hoặc Google Play Store (Android).
> - Quét mã QR code hiển thị trên terminal sau khi chạy `npm run tunnel` để mở trực tiếp app trên điện thoại.
> - Cả 2 ứng dụng đã được thiết lập chạy trên 2 cổng Metro Bundler riêng biệt (`8089` và `8090`) để bạn có thể mở đồng thời cả AppCustomer và AppShipper cùng lúc trên một máy tính mà không sợ xung đột port.

---

## 🛠️ Công Nghệ Nền Tảng (Mobile Tech Stack)

| Hạng mục | Thư viện / Công nghệ |
| :--- | :--- |
| **Core** | React 19, React Native 0.76+, Expo SDK 57 |
| **Điều hướng** | `@react-navigation/native-stack`, `@react-navigation/bottom-tabs` (v7) |
| **Phần cứng & Thiết bị** | `expo-location`, `expo-task-manager` (GPS ngầm), `expo-camera`, `expo-image-picker` |
| **Bản đồ** | `react-native-maps`, `react-native-webview`, Leaflet Map |
| **Biểu tượng** | `lucide-react-native`, `react-native-svg` |
| **Lưu trữ dữ liệu** | `@react-native-async-storage/async-storage` (Token, thông tin phiên đăng nhập) |
| **Kết nối mạng** | Axios, `@stomp/stompjs`, `sockjs-client`, `socket.io-client` |

---

## 🛡️ Giấy Phép
Dự án được thực hiện phục vụ Khóa luận tốt nghiệp (KLTN Delivery Food). Mọi quyền được bảo lưu.
