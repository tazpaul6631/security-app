import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'security.app',
  appName: 'security-app',
  webDir: 'dist',
  plugins: {
    CapacitorHttp: {
      enabled: true, // Kích hoạt HTTP native
    },
    CapacitorSQLite: {
      iosIsEncryption: false,
      iosKeychainPrefix: 'security-app',
      androidIsEncryption: false,
      logging: false, // Tắt log nội bộ của SQLite để console sạch hơn
    },
  },
  server: {
    // 10.0.2.2 là địa chỉ IP máy tính host khi nhìn từ Emulator
    url: 'http://10.0.149.28:8100',
    cleartext: true // Cho phép chạy HTTP (không cần HTTPS)
  }
};

export default config;
