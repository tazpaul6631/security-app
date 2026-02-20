import { Storage } from '@ionic/storage';

class StorageService {
  private _storage: Storage | null = null;

  constructor() {
    this.init();
  }

  // 1. Khởi tạo Storage
  async init(): Promise<void> {
    if (this._storage !== null) return; // Đã init rồi thì bỏ qua

    const storage = new Storage();
    const created = await storage.create();
    this._storage = created;
    console.log('--- Storage: Đã khởi tạo thành công ---');
  }

  // 2. Đảm bảo storage đã sẵn sàng trước khi thực hiện các lệnh khác
  private async ensureStorage(): Promise<Storage> {
    if (this._storage === null) {
      await this.init();
    }
    return this._storage!;
  }

  // 3. Lưu dữ liệu
  async set(key: string, value: any): Promise<void> {
    const store = await this.ensureStorage();
    await store.set(key, value);
  }

  // 4. Lấy dữ liệu
  async get(key: string): Promise<any> {
    const store = await this.ensureStorage();
    return await store.get(key);
  }

  // 5. Xóa một key cụ thể
  async remove(key: string): Promise<void> {
    const store = await this.ensureStorage();
    await store.remove(key);
  }

  // 6. Xóa sạch dữ liệu (Dùng khi logout)
  async clear(): Promise<void> {
    const store = await this.ensureStorage();
    await store.clear();
  }
}

// Export một instance duy nhất (Singleton)
const storageService = new StorageService();
export default storageService;