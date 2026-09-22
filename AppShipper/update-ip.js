const fs = require('fs');
const path = require('path');

// Đọc IP từ file .env ở thư mục hiện tại (AppShipper)
const envPath = path.join(__dirname, '.env');
if (!fs.existsSync(envPath)) {
  console.error('❌ Không tìm thấy file .env ở thư mục AppShipper!');
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
const ipMatch = envContent.match(/LOCAL_IP=([0-9\.]+)/);
if (!ipMatch) {
  console.error('❌ Không tìm thấy LOCAL_IP trong file .env!');
  process.exit(1);
}

const localIp = ipMatch[1];
console.log(`🚀 Đang cập nhật IP thành: ${localIp}...`);

const replaceIpInFile = (filePath, regex, replacement) => {
  const fullPath = path.join(__dirname, filePath);
  if (fs.existsSync(fullPath)) {
    const content = fs.readFileSync(fullPath, 'utf8');
    const newContent = content.replace(regex, replacement);
    if (content !== newContent) {
      fs.writeFileSync(fullPath, newContent, 'utf8');
      console.log(`✅ Đã cập nhật: ${filePath}`);
    } else {
      console.log(`➖ Không có thay đổi: ${filePath}`);
    }
  } else {
    console.warn(`⚠️ Không tìm thấy file: ${filePath}`);
  }
};

// 1. Cập nhật App Shipper (Chính nó)
replaceIpInFile(
  'src/lib/apiClient.js',
  /http:\/\/(localhost|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}):8080\/api\/v1/g,
  `http://${localIp}:8080/api/v1`
);

// 2. Cập nhật Customer Web - Tracking Page
replaceIpInFile(
  '../../DeliveryFood_FrontEnd/apps/web/src/app/(customer)/(order)/tracking/page.jsx',
  /http:\/\/(localhost|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}):8080\/api\/v1/g,
  `http://${localIp}:8080/api/v1`
);

// 3. Cập nhật Customer Web - Order Details
replaceIpInFile(
  '../../DeliveryFood_FrontEnd/apps/web/src/app/(customer)/(order)/orders/[id]/page.jsx',
  /http:\/\/(localhost|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}):8080\/api\/v1/g,
  `http://${localIp}:8080/api/v1`
);

// 4. Cập nhật Admin Dashboard - API Client (Thay thế toàn bộ localhost hoặc IP cũ)
replaceIpInFile(
  '../../DeliveryFood_FrontEnd/Delivery_Dashboard/src/api/client.ts',
  /http:\/\/(localhost|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}):/g,
  `http://${localIp}:`
);

console.log('🎉 Đã hoàn tất thay đổi IP! Khởi động lại các app để nhận IP mới nhé!');
