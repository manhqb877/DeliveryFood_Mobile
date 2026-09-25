const fs = require('fs');
const path = require('path');
const os = require('os');

// Tự động quét các interface mạng để lấy địa chỉ IP của máy tính
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

const localIp = getLocalIP();
console.log(`🚀 Đang tự động lấy IP máy tính: ${localIp}...`);

// 1. Cập nhật IP vào file .env
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  let envContent = fs.readFileSync(envPath, 'utf8');
  if (/LOCAL_IP=.*/.test(envContent)) {
    envContent = envContent.replace(/LOCAL_IP=.*/, `LOCAL_IP=${localIp}`);
  } else {
    envContent += `\nLOCAL_IP=${localIp}\n`;
  }
  fs.writeFileSync(envPath, envContent, 'utf8');
  console.log(`✅ Đã cập nhật IP vào file .env`);
} else {
  fs.writeFileSync(envPath, `LOCAL_IP=${localIp}\n`, 'utf8');
  console.log(`✅ Đã tạo mới file .env và thêm IP`);
}

// 2. Cập nhật vào apiClient.js nếu có
const apiClientPath = path.join(__dirname, 'src/api/apiClient.js');
if (fs.existsSync(apiClientPath)) {
  const content = fs.readFileSync(apiClientPath, 'utf8');
  const newContent = content.replace(
    /http:\/\/(localhost|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}):8080\/api\/v1/g,
    `http://${localIp}:8080/api/v1`
  );
  if (content !== newContent) {
    fs.writeFileSync(apiClientPath, newContent, 'utf8');
    console.log(`✅ Đã cập nhật: src/api/apiClient.js`);
  } else {
    console.log(`➖ Không có thay đổi: src/api/apiClient.js`);
  }
}

console.log('🎉 Đã hoàn tất thay đổi IP cho AppCustomer!');
