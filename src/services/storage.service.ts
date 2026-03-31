// services/storage.service.ts
import { useSQLite } from '@/composables/useSQLite';

class StorageService {
  // Không giải nén ở ngoài, mà gọi useSQLite() để lấy các hàm thực thi
  private sqlite = useSQLite();

  // Đảm bảo SQLite đã sẵn sàng trước khi thực hiện bất kỳ thao tác nào
  private async ensureReady() {
    // Luôn gọi initDatabase, hàm này đã có logic xử lý "initializationPromise" 
    // bên useSQLite để tránh khởi tạo chồng chéo
    await this.sqlite.initDatabase();
  }

  // 1. Lưu dữ liệu
  async set(key: string, value: any): Promise<void> {
    try {
      await this.ensureReady();
      await this.sqlite.setItem(key, value);
    } catch (error) {
      console.error(`StorageService Error (set ${key}):`, error);
    }
  }

  // 2. Lấy dữ liệu
  async get<T = any>(key: string): Promise<T | null> {
    try {
      await this.ensureReady();
      return await this.sqlite.getItem(key);
    } catch (error) {
      console.error(`StorageService Error (get ${key}):`, error);
      return null;
    }
  }

  // 3. Xóa một key cụ thể
  async remove(key: string): Promise<void> {
    try {
      await this.ensureReady();
      await this.sqlite.removeItem(key);
    } catch (error) {
      console.error(`StorageService Error (remove ${key}):`, error);
    }
  }

  // 4. Xóa sạch dữ liệu (Dùng khi logout)
  async clear(): Promise<void> {
    try {
      await this.ensureReady();
      await this.sqlite.logout();
    } catch (error) {
      console.error(`StorageService Error (clear):`, error);
    }
  }
}

// Xuất ra một instance duy nhất (Singleton)
const storageService = new StorageService();
export default storageService;