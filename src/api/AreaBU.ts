import request from '@/services/apiService';

export default {
  postAreaBU(data: any) {
    return request.post('/Area/getlist', { data });
  },
  getAreaBUId(id: any) {
    return request.get(`/Area/getone/${id}`);
  }
};