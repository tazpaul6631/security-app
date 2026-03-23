import request from '@/services/apiService';

export default {
    syncScanCpQrLog(data: any) {
        console.log(data);

        return request.post('/Sync/syncscancpqrlog', data);
    }
};