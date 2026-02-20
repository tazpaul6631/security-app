import { Filesystem, Directory, ReadFileResult, GetUriResult } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';

export const ImageService = {
  /**
   * Lưu Base64 thành file thực tế trong bộ nhớ máy
   * @param base64Data Chuỗi base64 (có hoặc không có prefix data:image/...)
   * @returns Tên file đã lưu
   */
  async saveImage(base64Data: string): Promise<string> {
    // 1. Tách bỏ tiền tố "data:image/jpeg;base64," nếu có
    const rawData: string = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
    
    const fileName = `offline_img_${Date.now()}.jpg`;
    
    await Filesystem.writeFile({
      path: fileName,
      data: rawData, // Chỉ gửi phần mã hóa sạch
      directory: Directory.Data
    });
    
    return fileName;
  },

  /**
   * Đọc file ra Base64 để gửi API
   * @param fileName Tên file cần đọc
   * @returns Chuỗi base64 sạch hoặc null nếu lỗi
   */
  async readImage(fileName: string): Promise<string | null> {
    try {
      const file: ReadFileResult = await Filesystem.readFile({
        path: fileName,
        directory: Directory.Data
      });
      
      // Kết quả trả về từ readFile (file.data) đã là Base64 sạch
      return file.data as string; 
    } catch (e) {
      console.error("Không thể đọc file:", fileName, e);
      return null;
    }
  },

  /**
   * Xóa file sau khi đồng bộ xong để giải phóng bộ nhớ
   * @param fileName Tên file cần xóa
   */
  async deleteImage(fileName: string): Promise<void> {
    try {
      await Filesystem.deleteFile({
        path: fileName,
        directory: Directory.Data
      });
    } catch (e) {
      console.warn("File không tồn tại hoặc đã bị xóa trước đó:", fileName);
    }
  },

  /**
   * Lấy URL để hiển thị lên UI (thẻ <img :src="...">)
   * @param fileName Tên file trong bộ nhớ
   * @returns URL đã convert cho WebView hoặc null
   */
  async getDisplayUrl(fileName: string): Promise<string | null> {
    try {
      const result: GetUriResult = await Filesystem.getUri({
        path: fileName,
        directory: Directory.Data
      });
      
      // Chuyển đổi path hệ thống (file://...) sang WebView URL (http://localhost/...)
      // Cần import { Capacitor } from '@capacitor/core'
      return Capacitor.convertFileSrc(result.uri);
    } catch (e) {
      console.error("Lỗi lấy URL ảnh:", e);
      return null;
    }
  },
};