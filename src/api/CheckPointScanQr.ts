import request from '@/services/apiService';

export default {
  postCheckPointView(data: any) {
    return request.post(`/CheckPointView/getlist`, { areaIds: data.areaIds, roleIdStr: data.roleIdStr });
  },
  getCheckPointScanQr(listScanQr: any) {
    return request.get(`/CheckPointView/scanqr/${listScanQr.cpwId}/${listScanQr.cpwCode}`);
  }
};