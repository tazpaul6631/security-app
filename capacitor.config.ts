import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'security.app',
  appName: 'security-app',
  webDir: 'dist',
  plugins: {
    CapacitorHttp: {
      enabled: false, // Kích hoạt HTTP native nhớ sửa thành false
    },
    CapacitorSQLite: {
      iosIsEncryption: false,
      iosKeychainPrefix: 'security-app',
      androidIsEncryption: false,
      logging: false, // Tắt log nội bộ của SQLite để console sạch hơn
    },
  },
  // server: {
  //   url: 'http://10.0.149.28:8100',
  //   cleartext: true, // Cho phép chạy HTTP (không cần HTTPS)
  //   allowNavigation: ['10.0.149.28']
  // }
};

export default config;