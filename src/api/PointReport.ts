import request from '@/services/apiService';

export default {
  postPointReportView() {
    return request.post('/PointReportView/getlist', {});
  },
  postBasePointReportView(id: any) {
    return request.post('/PointReportView/getbaselist', { psId: id });
  },
  getPointReportId(id: any) {
    return request.get(`/PointReportView/getone/${id}`);
  },
  createPointReport(formData: FormData) {
    console.log('Gửi dữ liệu lên BE (FormData):', formData);
    return request.post(`/PointReport/create`, formData);
  }
};