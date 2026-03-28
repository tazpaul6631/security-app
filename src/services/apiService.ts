import baseURLMixin from '@/mixins/baseURLMixin';
import storageService from '@/services/storage.service';

const baseURL: string = baseURLMixin.url;

// Định nghĩa các method hợp lệ
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

const request = {
  /**
   * Hàm xử lý chung sử dụng FETCH thuần của WebView
   * Bỏ qua lỗi SSL khắt khe của Android Native
   */
  async send(method: HttpMethod, url: string, data: any = null): Promise<any> {
    // LẤY TOKEN TỪ SQLITE/STORAGE TRƯỚC KHI GỬI
    const token = await storageService.get('user_token');
    const headers: HeadersInit = {}; // KHÔNG để mặc định là application/json

    // Nếu data KHÔNG PHẢI là FormData thì mới set application/json
    if (!(data instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const options: RequestInit = {
      method: method,
      headers: headers,
    };

    if (data && method !== 'GET') {
      if (data instanceof FormData) {
        // Nếu là FormData, để fetch tự xử lý body, KHÔNG stringify
        options.body = data;
      } else {
        options.body = JSON.stringify(data);
      }
    }

    try {
      const response = await fetch(`${baseURL}${url}`, options);

      // Xử lý lỗi 401 (Token hết hạn)
      if (response.status === 401) {
        console.warn("Token hết hạn, đang đăng xuất...");
        await storageService.clear();
        window.location.href = '/login';
      }

      if (!response.ok) {
        throw response;
      }

      // Parse JSON
      const responseData = await response.json();
      return {
        data: responseData,
        status: response.status,
        url: response.url
      };

    } catch (error) {
      console.error(`[Network/Fetch Error] ${method} ${url}:`, error);
      throw error;
    }
  },

  // Các hàm rút gọn giữ nguyên
  get(url: string) {
    return this.send('GET', url);
  },

  post(url: string, data?: any) {
    return this.send('POST', url, data);
  },

  put(url: string, data?: any) {
    return this.send('PUT', url, data);
  },

  delete(url: string) {
    return this.send('DELETE', url);
  },

  patch(url: string, data?: any) {
    return this.send('PATCH', url, data);
  }
};

export default request;