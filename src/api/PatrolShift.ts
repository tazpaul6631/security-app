import request from '@/services/apiService';

export default {
    postRemovePatrolShift(data: any) {
        return request.post('/PatrolShift/cancel', {
            routeId: data.routeId,
            psId: data.psId,
            updatedBy: data.updatedBy
        });
    },
};