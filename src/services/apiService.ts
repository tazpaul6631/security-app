import baseURLMixin from '@/mixins/baseURLMixin';
import storageService from '@/services/storage.service';
import store from '@/composables/useVuex';

const baseURL: string = baseURLMixin.url;

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export interface RequestConfig {
  timeoutMs?: number;
}

const request = {
  async send(method: HttpMethod, url: string, data: any = null, config?: RequestConfig): Promise<any> {
    const token = await storageService.get('user_token');
    const headers: HeadersInit = {};

    if (!(data instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const controller = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    if (config?.timeoutMs && config.timeoutMs > 0) {
      timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);
    }

    const options: RequestInit = {
      method: method,
      headers: headers,
      signal: controller.signal,
    };

    if (data && method !== 'GET') {
      if (data instanceof FormData) {
        options.body = data;
      } else {
        options.body = JSON.stringify(data);
      }
    }

    try {
      const response = await fetch(`${baseURL}${url}`, options);

      // --- LOGIC MỚI BẮT ĐẦU TỪ ĐÂY ---

      // 1. NẾU SERVER PHẢN HỒI THÀNH CÔNG -> CHẮC CHẮN LÀ ĐANG ONLINE
      if (response.ok && !store.state.isOnline) {
        store.commit('SET_NETWORK_STATUS', true);
      }

      // 2. Xử lý lỗi 401 (Token hết hạn)
      if (response.status === 401) {
        store.commit('SET_TOKEN', null);
        await storageService.remove('user_token');

        window.location.href = '/login';
        throw response; // Phải throw để dừng tiến trình
      }

      // 3. NẾU SERVER BÁO LỖI HỆ THỐNG (500, 502, 503, 504) -> ÉP VỀ OFFLINE
      if (response.status >= 500) {
        store.commit('SET_NETWORK_STATUS', false);
        throw response; // Vẫn throw để UI bên ngoài bắt được lỗi và nhảy vào khối catch hiển thị cảnh báo (nếu có)
      }

      // --- KẾT THÚC LOGIC MỚI ---

      if (!response.ok) {
        throw response;
      }

      const responseData = await response.json();
      return {
        data: responseData,
        status: response.status,
        url: response.url
      };

    } catch (error: any) {
      if (error?.name === 'AbortError') {
        throw {
          isCustom: true,
          code: 'REQUEST_TIMEOUT',
          message: 'Request timed out',
        };
      }

      // 4. BẮT LỖI SẬP MẠNG HOÀN TOÀN (Server sập hẳn, mất kết nối mạng, CORS)
      // fetch API sẽ ném ra TypeError với message 'Failed to fetch' khi không thể chạm tới máy chủ
      if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
        store.commit('SET_NETWORK_STATUS', false);
      }

      throw error;
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  },

  get(url: string) {
    return this.send('GET', url);
  },

  post(url: string, data?: any, config?: RequestConfig) {
    return this.send('POST', url, data, config);
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