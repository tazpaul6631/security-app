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
  createPointReport(data: any) {
    console.log(data);

    return request.post(`/PointReport/create`, {
      psId: data.psId,
      routeId: data.routeId,
      rdId: data.rdId,
      prHasProblem: data.prHasProblem,
      createdAt: data.createdAt,
      createdBy: data.createdBy,
      scanAt: data.scanAt,
      noteGroups: data.noteGroups,
      prNote: data.prNote,
      prLat: data.prLat,
      prLng: data.prLng,
      prprAccuracy: data.prprAccuracy
    })
  }
};