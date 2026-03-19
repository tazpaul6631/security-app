import request from '@/services/apiService';

export default {
  getCheckPointScanQr(listScanQr: any) {
    return request.get(`/CheckPointView/scanqr/${listScanQr.cpwId}/${listScanQr.cpwCode}`);
  }
};