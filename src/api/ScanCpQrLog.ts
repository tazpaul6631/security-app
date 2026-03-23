import request from '@/services/apiService';

export default {
    createScanCpQrLog(data: any) {
        return request.post('/ScanCpQrLog/create', data);
    }
};