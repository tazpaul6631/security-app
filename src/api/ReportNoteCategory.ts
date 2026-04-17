import request from '@/services/apiService';

export default {
    postReportNoteCategory() {
        return request.post(`/ReportNoteCategory/getbaselist`, {});
    }
};