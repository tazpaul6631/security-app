import request from '@/services/apiService';

export default {
    postUserView() {
        return request.post('/UserView/getlist', {});
    }
};