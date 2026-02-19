# 🛡️ Security App - Mobile Solution

Ứng dụng bảo mật được phát triển trên nền tảng **Ionic + Capacitor + Vue 3**, tích hợp với Backend C# để cung cấp giải pháp an ninh toàn diện.

## 🚀 Tính năng chính
* **Real-time Monitoring:** Giám sát an ninh theo thời gian thực.
* **High Performance:** Tối ưu hóa hiệu năng với Gradle Caching.
* **Cross-platform:** Chạy mượt mà trên Android (đã test trên Samsung S24 Ultra).

## 🛠️ Công nghệ sử dụng
* **Frontend:** Vue 3, Ionic Framework, Capacitor.
* **Backend:** C# (.NET Core).
* **Build Tool:** Gradle 8.x.
* **Automation:** GitHub Actions (Tự động build APK).

## 📖 Hướng dẫn cài đặt & Chạy Project

### 1. Yêu cầu hệ thống
* Node.js (phiên bản 18 trở lên).
* Android Studio + SDK 34+.
* Java JDK 17.

### 2. Cài đặt môi trường
```bash
# Cài đặt các thư viện Node.js
npm install

# Đồng bộ code Web sang thư mục Android
npx cap sync

