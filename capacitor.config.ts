import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'security.app',
  appName: 'security-app',
  webDir: 'dist',
  server: {
    // 10.0.2.2 là địa chỉ IP máy tính host khi nhìn từ Emulator
    url: 'http://192.168.100.62:8100', 
    cleartext: true // Cho phép chạy HTTP (không cần HTTPS)
  }
};

export default config;
