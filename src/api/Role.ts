import request from '@/services/apiService';

export default {
  postRole() {
    return request.post(`/Role/getlist`, {});
  },
  postBaseRole() {
    return request.post(`/Role/getbaselist`, {});
  },
};