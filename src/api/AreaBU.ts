import request from '@/services/apiService';

export default {
  postAreaBU(data: any) {
    return request.post('/Area/getlist', { data });
  }
};