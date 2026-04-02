import request from '@/services/apiService';

export default {
  postUser() {
    return request.post(`/User/getlist`, {});
  },
  postUserValidate(loginDetail: any) {
    return request.post(`/User/validate/`,
      {
        userCode: loginDetail.userCode,
        userPassword: loginDetail.userPassword
      }
    );
  }
};