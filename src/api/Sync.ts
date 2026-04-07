import request from '@/services/apiService';

export default {
    syncScanCpQrLog(data: any) {
        return request.post('/Sync/syncscancpqrlog', data);
    }
};