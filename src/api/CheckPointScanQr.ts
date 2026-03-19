import request from '@/services/apiService';

export default {
  postCheckPointView() {
    return request.post(`/CheckPointView/getlist`, {});
  },
  getCheckPointScanQr(listScanQr: any) {
    return request.get(`/CheckPointView/scanqr/${listScanQr.cpwId}/${listScanQr.cpwCode}`);
  }
};