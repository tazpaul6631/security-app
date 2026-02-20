import { ref } from 'vue';
import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite';

// Định nghĩa Interface để TypeScript hỗ trợ gợi ý code (Intellisense)
interface UserProfile {
  id: number;
  name: string;
  email: string;
}

interface Product {
  id: number;
  title: string;
  price: number;
  category: string;
}

interface ApiSyncData {
  profile?: UserProfile;
  products?: Product[];
}

// --- PHẦN CẤU HÌNH CƠ SỞ DỮ LIỆU ---
const DB_NAME = 'my_app_db';
const schema = `
  CREATE TABLE IF NOT EXISTS auth_session (
    id INTEGER PRIMARY KEY,
    token TEXT,
    user_id INTEGER,
    is_logged_in INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS profile (
    id INTEGER PRIMARY KEY,
    name TEXT,
    email TEXT
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY,
    title TEXT,
    price REAL,
    category TEXT
  );

  CREATE TABLE IF NOT EXISTS sync_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT,
    payload TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`;

// --- SINGLETON INSTANCES ---
const sqliteConnection = new SQLiteConnection(CapacitorSQLite);
const dbInstance = ref<SQLiteDBConnection | null>(null);
const isReady = ref(false);

export function useSQLite() {

  // 1. Khởi tạo Database
  const initDatabase = async (): Promise<void> => {
    if (isReady.value) return;
    try {
      // Kiểm tra kết nối cũ để tránh lỗi "Connection already exists"
      const isConn = await sqliteConnection.isConnection(DB_NAME, false);
      let db: SQLiteDBConnection;
      
      if (isConn.result) {
        db = await sqliteConnection.retrieveConnection(DB_NAME, false);
      } else {
        db = await sqliteConnection.createConnection(DB_NAME, false, 'no-encryption', 1, false);
      }

      await db.open();
      await db.execute(schema);
      
      dbInstance.value = db;
      isReady.value = true;
      console.log('--- SQLite: Hệ thống đã sẵn sàng (TS Version) ---');
    } catch (err) {
      console.error('Lỗi khởi tạo SQLite:', err);
    }
  };

  // 2. Đổ dữ liệu từ API vào các bảng
  const syncDataFromServer = async (apiData: ApiSyncData): Promise<void> => {
    if (!dbInstance.value) return;

    try {
      await dbInstance.value.execute('BEGIN TRANSACTION');

      // Lưu Profile
      const p = apiData.profile;
      if (p) {
        const profileSql = 'INSERT OR REPLACE INTO profile (id, name, email) VALUES (?, ?, ?)';
        await dbInstance.value.run(profileSql, [p.id, p.name, p.email]);
      }

      // Lưu danh sách sản phẩm
      if (apiData.products && Array.isArray(apiData.products)) {
        for (const prod of apiData.products) {
          const productSql = 'INSERT OR REPLACE INTO products (id, title, price, category) VALUES (?, ?, ?, ?)';
          await dbInstance.value.run(productSql, [prod.id, prod.title, prod.price, prod.category]);
        }
      }

      await dbInstance.value.execute('COMMIT');
      console.log('--- SQLite: Đã đồng bộ dữ liệu vào máy ---');
    } catch (err) {
      if (dbInstance.value) await dbInstance.value.execute('ROLLBACK');
      console.error('Lỗi đồng bộ dữ liệu:', err);
    }
  };

  // 3. Lấy dữ liệu sản phẩm
  const getProducts = async (): Promise<any[]> => {
    if (!dbInstance.value) return [];
    const res = await dbInstance.value.query('SELECT * FROM products');
    return res.values || [];
  };

  // 4. Lưu thao tác vào hàng chờ khi Offline
  const addActionToQueue = async (action: string, data: any): Promise<void> => {
    if (!dbInstance.value) return;
    try {
      const payload = JSON.stringify(data);
      await dbInstance.value.run(
        'INSERT INTO sync_queue (action, payload) VALUES (?, ?)',
        [action, payload]
      );
      console.log(`--- SQLite: Đã lưu ${action} vào hàng chờ ---`);
    } catch (err) {
      console.error('Lỗi khi lưu vào sync_queue:', err);
    }
  };

  // 5. Xử lý hàng chờ đồng bộ
  const processSyncQueue = async (
    apiCallback: (action: string, payload: any) => Promise<boolean>
  ): Promise<void> => {
    if (!dbInstance.value) return;

    try {
      const res = await dbInstance.value.query('SELECT * FROM sync_queue ORDER BY created_at ASC');
      const queue = res.values || [];

      if (queue.length === 0) return;

      for (const item of queue) {
        try {
          const payload = JSON.parse(item.payload);
          const success = await apiCallback(item.action, payload);

          if (success) {
            await dbInstance.value.run('DELETE FROM sync_queue WHERE id = ?', [item.id]);
          } else {
            break;
          }
        } catch (err) {
          console.error(`Lỗi xử lý mục ${item.id}:`, err);
          break; 
        }
      }
    } catch (globalErr) {
      console.error('Lỗi truy vấn hàng chờ:', globalErr);
    }
  };

  // 6. Kiểm tra phiên đăng nhập
  const checkAuthStatus = async (): Promise<any | null> => {
    if (!dbInstance.value) return null;
    const res = await dbInstance.value.query(
      'SELECT * FROM auth_session WHERE is_logged_in = 1 LIMIT 1'
    );
    return (res.values && res.values.length > 0) ? res.values[0] : null;
  };

  // Lưu phiên đăng nhập
  const saveAuthSession = async (user: { id: number }, token: string): Promise<void> => {
    if (!dbInstance.value) return;
    try {
      await dbInstance.value.run('DELETE FROM auth_session');
      await dbInstance.value.run(
        'INSERT INTO auth_session (user_id, token, is_logged_in) VALUES (?, ?, 1)',
        [user.id, token]
      );
    } catch (err) {
      console.error('Lỗi lưu session:', err);
    }
  };

  // 7. Logout
  const logout = async (): Promise<void> => {
    if (!dbInstance.value) return;
    try {
      await dbInstance.value.execute('BEGIN TRANSACTION');
      await dbInstance.value.run('DELETE FROM auth_session');
      await dbInstance.value.run('DELETE FROM profile');
      await dbInstance.value.run('DELETE FROM products');
      await dbInstance.value.run('DELETE FROM sync_queue');
      await dbInstance.value.execute('COMMIT');
      isReady.value = false;
    } catch (err) {
      if (dbInstance.value) await dbInstance.value.execute('ROLLBACK');
      console.error('Lỗi đăng xuất:', err);
    }
  };

  return { 
    isReady, 
    initDatabase, 
    syncDataFromServer, 
    getProducts, 
    addActionToQueue,
    processSyncQueue,
    checkAuthStatus,
    saveAuthSession,
    logout
  };
}