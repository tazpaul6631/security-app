import { ref } from 'vue';
import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection, capSQLiteSet } from '@capacitor-community/sqlite';

const DB_NAME = 'security_app_db';

const schema = `
  CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
  CREATE TABLE IF NOT EXISTS profile (id INTEGER PRIMARY KEY, name TEXT, email TEXT);
  CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY, title TEXT, price REAL);
  CREATE TABLE IF NOT EXISTS sync_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT, 
    action TEXT, 
    payload TEXT, 
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`;

// --- BIẾN TOÀN CỤC (Để dùng chung instance xuyên suốt App) ---
const sqliteConnection = new SQLiteConnection(CapacitorSQLite);
const dbInstance = ref<SQLiteDBConnection | null>(null);
const isReady = ref(false);

// VŨ KHÍ BÍ MẬT: Biến này để quản lý việc đang khởi tạo
let initializationPromise: Promise<void> | null = null;

export function useSQLite() {

  const initDatabase = async () => {
    // 1. Nếu đã xong rồi thì trả về luôn
    if (isReady.value && dbInstance.value) return;

    // 2. Nếu ĐANG có một luồng khác khởi tạo, hãy đợi luồng đó xong
    if (initializationPromise) {
      return initializationPromise;
    }

    // 3. Nếu chưa có ai làm, ta bắt đầu làm và đánh dấu cho người sau biết
    initializationPromise = (async () => {
      try {
        console.log('--- SQLite: Bắt đầu khởi tạo ---');
        await sqliteConnection.checkConnectionsConsistency();
        const isConn = await sqliteConnection.isConnection(DB_NAME, false);

        let db: SQLiteDBConnection;

        if (isConn.result) {
          db = await sqliteConnection.retrieveConnection(DB_NAME, false);
        } else {
          db = await sqliteConnection.createConnection(DB_NAME, false, 'no-encryption', 1, false);
        }

        const isOpen = await db.isDBOpen();
        if (!isOpen.result) {
          await db.open();
        }

        await db.execute(schema);
        dbInstance.value = db;
        isReady.value = true;
        console.log('--- SQLite: Sẵn sàng ---');

      } catch (err: any) {
        console.warn('--- SQLite: Xung đột, xử lý dọn dẹp kết nối lỗi ---');
        try {
          // Xử lý lỗi "No available connection" bằng cách đóng kết nối bị treo
          await sqliteConnection.closeConnection(DB_NAME, false);
          const db = await sqliteConnection.createConnection(DB_NAME, false, 'no-encryption', 1, false);
          await db.open();
          await db.execute(schema);
          dbInstance.value = db;
          isReady.value = true;
        } catch (finalErr) {
          console.error('--- SQLite: Lỗi khởi tạo nghiêm trọng ---', finalErr);
          throw finalErr;
        }
      } finally {
        // Sau khi xong (thành công hoặc thất bại), giải phóng Promise
        initializationPromise = null;
      }
    })();

    return initializationPromise;
  };

  // --- Các hàm setItem, getItem, v.v. cần dùng await initDatabase() ---

  const setItem = async (key: string, value: any) => {
    await initDatabase(); // Luôn đảm bảo DB sẵn sàng trước khi ghi
    const valStr = JSON.stringify(value);
    await dbInstance.value?.run(
      'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
      [key, valStr]
    );
  };

  const getItem = async (key: string): Promise<any | null> => {
    await initDatabase(); // Luôn đảm bảo DB sẵn sàng trước khi đọc
    const res = await dbInstance.value?.query('SELECT value FROM settings WHERE key = ?', [key]);
    if (res?.values && res.values.length > 0) {
      try {
        return JSON.parse(res.values[0].value);
      } catch (e) {
        return res.values[0].value;
      }
    }
    return null;
  };

  const removeItem = async (key: string) => {
    await initDatabase();
    await dbInstance.value?.run('DELETE FROM settings WHERE key = ?', [key]);
  };

  // Trong composables/useSQLite.ts
  const logout = async () => {
    await initDatabase();
    if (!dbInstance.value) return;
    try {
      // 1. Xóa thông tin cá nhân trong bảng profile
      await dbInstance.value.execute(`DELETE FROM profile;`);

      // 2. XÓA SẠCH bảng settings (Key-Value)
      // Không nên giữ lại bất kỳ category nào vì mỗi User có thể có quyền xem Area khác nhau
      await dbInstance.value.execute(`DELETE FROM settings;`);

      // 3. Xóa cả hàng chờ đồng bộ (sync_queue) để tránh gửi nhầm dữ liệu của người cũ
      await dbInstance.value.execute(`DELETE FROM sync_queue;`);

      console.log('✅ SQLite: Đã dọn dẹp sạch sẽ toàn bộ dữ liệu local.');
    } catch (err) {
      console.error('Lỗi logout SQLite:', err);
    }
  };

  return {
    isReady,
    initDatabase,
    setItem,
    getItem,
    removeItem,
    logout,
    // Trả về thêm instance để dùng trực tiếp nếu cần
    getDbInstance: () => dbInstance.value
  };
}