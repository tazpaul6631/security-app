import request from '@/services/apiService';

export default {
    syncScanCpQrLog(data: any) {
        return request.post('/Sync/syncscancpqrlog', data, { withRequestBy: true });
    },
    syncPointReport(formData: FormData) {
        return request.post('/Sync/syncpointreport', formData, { withRequestBy: true });
    },
    syncPatrolLog(data: any) {
        return request.post('/Sync/syncpatrollog', data, { withRequestBy: true });
    }
};