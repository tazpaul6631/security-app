import request from '@/services/apiService';

export default {
    syncScanCpQrLog(data: any) {
        return request.post('/Sync/syncscancpqrlog', data);
    },
    syncPointReport(formData: FormData) {
        return request.post('/Sync/syncpointreport', formData);
    },
    syncPatrolLog(data: any) {
        return request.post('/Sync/syncpatrollog', data);
    }
};