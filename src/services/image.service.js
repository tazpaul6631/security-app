import { Filesystem, Directory } from '@capacitor/filesystem';

export const ImageService = {
  // Lưu Base64 thành file thực tế
  async saveImage(base64Data) {
    // 1. Tách bỏ tiền tố "data:image/jpeg;base64," nếu có
    const rawData = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
    
    const fileName = `offline_img_${Date.now()}.jpg`;
    
    await Filesystem.writeFile({
      path: fileName,
      data: rawData, // Chỉ gửi phần mã hóa sạch
      directory: Directory.Data
    });
    
    return fileName;
  },

  // Đọc file ra Base64 để gửi API
  async readImage(fileName) {
    try {
      const file = await Filesystem.readFile({
        path: fileName,
        directory: Directory.Data
      });
      // Kết quả trả về từ readFile đã là Base64 sạch
      return file.data; 
    } catch (e) {
      console.error("Không thể đọc file:", fileName, e);
      return null;
    }
  },

  // Xóa file sau khi đồng bộ xong
  async deleteImage(fileName) {
    try {
      await Filesystem.deleteFile({
        path: fileName,
        directory: Directory.Data
      });
    } catch (e) {
      console.warn("File không tồn tại hoặc đã bị xóa trước đó:", fileName);
    }
  },

  // Lấy URL để hiển thị lên thẻ <img :src="...">
  async getDisplayUrl(fileName) {
    try {
      const result = await Filesystem.getUri({
        path: fileName,
        directory: Directory.Data
      });
      
      // Chuyển đổi path hệ thống (file://...) sang WebView URL (http://localhost/...)
      return Capacitor.convertFileSrc(result.uri);
    } catch (e) {
      console.error("Lỗi lấy URL ảnh:", e);
      return null;
    }
  },
};