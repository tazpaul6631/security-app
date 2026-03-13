import { createStore } from 'vuex'
import storageService from '@/services/storage.service'

// Tạo store mới
const store = createStore({
  // 1. State: Chứa dữ liệu (giống data)
  state() {
    return {
      dataMenu: [],
      dataListCP: [],
      dataCheckpointsId: [],
      dataAreaBU: [],
      dataListRoute: [],
      dataBasePointReportView: [],
      dataReportNoteCategory: [],
      dataUser: null,
      dataScanQr: null,
      token: null,
      currentTime: null,
      isHydrated: false,
      routeId: null,
      psId: null,
      unfinishedRouteId: null,

      // Quản lý đồng bộ
      syncProgress: 0,
      syncMessage: '',
      isOnline: true,
      isSyncing: false,

      currentCheckpoint: null,
    }
  },

  // 2. Getters: Tính toán dữ liệu từ state (giống computed)
  getters: {},

  // 3. Mutations: Hàm đồng bộ duy nhất được phép thay đổi State
  mutations: {
    SET_PSID(state, data) {
      state.psId = data
    },
    SET_DATAMENU(state, data) {
      state.dataMenu = data
    },
    SET_DATACP(state, data) {
      state.dataListCP = data
    },
    SET_DATA_CHECKPOINTS_ID(state, data) {
      console.log(data);

      state.dataCheckpointsId = data
    },
    SET_DATA_AREA_BU(state, data) {
      state.dataAreaBU = data
    },
    SET_DATA_LIST_ROUTE(state: any, data) {
      const apiData = Array.isArray(data) ? data : (data?.data || []);
      const localRoutes = state.dataListRoute || [];

      let mergedList = [...apiData];

      // Duyệt qua dữ liệu cũ để giữ lại những ca không có trong dữ liệu mới (ví dụ ca 10h)
      localRoutes.forEach((localR: any) => {
        const isInApi = apiData.some((apiR: any) => apiR.routeId === localR.routeId);
        if (!isInApi) {
          mergedList.push(localR); // Giữ lại ca cũ (ví dụ ca 10h đã xong)
        }
      });

      state.dataListRoute = apiData.map((apiRoute: any) => {
        const localRoute = localRoutes.find((r: any) => r.routeId === apiRoute.routeId);
        return {
          ...apiRoute,
          areaId: Number(apiRoute.areaId),
          roleId: Number(apiRoute.roleId),
          psHourFrom: Number(apiRoute.psHourFrom),
          psHourTo: Number(apiRoute.psHourTo),
          routeDetails: apiRoute.routeDetails.map((apiPoint: any) => {
            const localPoint = localRoute?.routeDetails.find((p: any) => p.cpId === apiPoint.cpId);
            return {
              ...apiPoint,
              status: (localPoint?.status === 1) ? 1 : apiPoint.status
            };
          })
        };
      });

      if (state.unfinishedRouteId) {
        // 1. Chống mất ca dở dang trong danh sách
        const isStillInList = state.dataListRoute.some((r: any) => r.routeId === state.unfinishedRouteId);
        if (!isStillInList) {
          const lockedRoute = localRoutes.find((r: any) => r.routeId === state.unfinishedRouteId);
          if (lockedRoute) state.dataListRoute.unshift(lockedRoute);
        }

        // 2. QUAN TRỌNG: Cập nhật lại psId từ lộ trình đang bị khóa
        const currentLocked = state.dataListRoute.find((r: any) => r.routeId === state.unfinishedRouteId);
        if (currentLocked && currentLocked.psId) {
          state.psId = currentLocked.psId;
          console.log("🎯 Store: Đã khôi phục psId từ khóa dở dang:", state.psId);
        }
      }
    },

    SET_DATA_BASE_POINT_REPORT_VIEW(state: any, data) {
      const rawData = Array.isArray(data) ? data : (data?.data || []);

      state.dataBasePointReportView = rawData.map((route: any) => ({
        ...route
      }));
    },
    SET_DATAUSER(state, data) {
      state.dataUser = data
    },
    SET_DATASCANQR(state, data) {
      state.dataScanQr = data
    },
    SET_TOKEN(state, data) {
      state.token = data
    },
    SET_CURRENT_TIME(state, data) {
      state.currentTime = data
    },
    SET_HYDRATED(state, data) {
      state.isHydrated = data
    },
    SET_ROUTE_ID(state, id) {
      state.routeId = id
    },
    SET_DATA_REPORT_NOTE_CATEGORY(state, data) {
      state.dataReportNoteCategory = data
    },
    SET_NETWORK_STATUS(state, status) {
      state.isOnline = status;
    },
    SET_SYNC_STATUS(state, { progress, message, isSyncing }) {
      state.syncProgress = progress;
      state.syncMessage = message;
      state.isSyncing = isSyncing;
    },
    SET_CURRENT_CHECKPOINT(state, data) {
      state.currentCheckpoint = data;
    },

    SET_UNFINISHED_ROUTE_ID(state: any, id: any) { // Thêm : any ở đây
      state.unfinishedRouteId = id;
      if (id) {
        storageService.set('unfinished_route_id', id);

        // Tự động tìm và gán psId từ danh sách lộ trình dựa trên routeId
        if (Array.isArray(state.dataListRoute)) {
          const found = state.dataListRoute.find((r: any) => Number(r.routeId) === Number(id));
          if (found && found.psId) {
            state.psId = found.psId;
            console.log("🎯 Đã tự động cập nhật psId:", state.psId);
          }
        }
      } else {
        storageService.remove('unfinished_route_id');
      }
    },

    // Cập nhật lại RESET_ROUTE_DATA để xóa cả khóa cứng
    RESET_ROUTE_DATA(state: any) {
      state.routeId = null;
      state.unfinishedRouteId = null; // Thêm dòng này
      if (Array.isArray(state.dataListRoute)) {
        state.dataListRoute = state.dataListRoute.map((route: any) => ({
          ...route,
          routeDetails: route.routeDetails.map((point: any) => ({
            ...point,
            status: 0
          }))
        }));
      }
    },

    // Hàm bơm báo cáo Offline giả vào Store (Đã fix lỗi gạch chân)
    ADD_OFFLINE_REPORT(state: any, report: any) {
      // 1. Nhét vào kho tổng CheckpointsId (Bây giờ nó chắc chắn là Mảng)
      console.log(state);
      console.log(report);

      let allReports = Array.isArray(state.dataCheckpointsId) ? state.dataCheckpointsId : [];

      // Đẩy báo cáo mới lên đầu mảng và gán thẳng lại (Không cần .data nữa)
      state.dataCheckpointsId = [report, ...allReports];

      // 2. Nhét trực tiếp vào màn hình CPIndex hiện tại (nếu đang xem đúng khu vực đó)
      let currentCPList = [];
      if (Array.isArray(state.dataListCP)) {
        currentCPList = state.dataListCP[0]?.data || state.dataListCP;
        console.log(currentCPList);
      } else {
        currentCPList = state.dataListCP?.data || [];
        console.log(currentCPList);
      }

      console.log(currentCPList);

      // Nếu danh sách rỗng hoặc cpId trùng với màn hình đang xem thì bơm vào UI
      if (currentCPList.length === 0 || String(currentCPList[0]?.cpId) === String(report.cpId)) {
        currentCPList = [report, ...currentCPList];

        console.log(currentCPList);
        state.dataListCP = [{ data: currentCPList }];
      }
    },

    // Hàm quét sạch báo cáo ảo khỏi Vuex
    REMOVE_OFFLINE_REPORT(state: any, prId: any) {
      // 1. Quét và xóa khỏi kho tổng (dataCheckpointsId)
      if (Array.isArray(state.dataCheckpointsId)) {
        state.dataCheckpointsId = state.dataCheckpointsId.filter(
          (item: any) => String(item.prId) !== String(prId)
        );
      }

      // 2. Quét và xóa khỏi màn hình danh sách hiện tại (dataListCP)
      let currentCPList = [];
      if (Array.isArray(state.dataListCP)) {
        currentCPList = state.dataListCP[0]?.data || state.dataListCP;
      } else {
        currentCPList = state.dataListCP?.data || [];
      }

      if (Array.isArray(currentCPList)) {
        currentCPList = currentCPList.filter(
          (item: any) => String(item.prId) !== String(prId)
        );
        // Gán ngược lại vào Store theo đúng cấu trúc cũ
        state.dataListCP = [{ data: currentCPList }];
      }
    },

    // Thêm vào trong mutations
    UPDATE_POINT_STATUS(state: any, { routeId, cpId, status }) {
      if (!state.dataListRoute) return;

      if (!state.unfinishedRouteId && status === 1) {
        // Gọi logic khóa ID
        state.unfinishedRouteId = routeId;
        storageService.set('unfinished_route_id', routeId);

        // Tìm psId để gán vào state ngay lập tức
        const found = state.dataListRoute.find((r: any) => Number(r.routeId) === Number(routeId));
        if (found) {
          state.psId = found.psId;
        }
      }

      state.dataListRoute = state.dataListRoute.map((route: any) => {
        if (Number(route.routeId) !== Number(routeId)) return route;

        const newDetails = route.routeDetails.map((detail: any) => {
          if (Number(detail.cpId) === Number(cpId)) {
            return { ...detail, status: status };
          }
          return detail;
        });
        return { ...route, routeDetails: newDetails };
      });

      storageService.set('list_route', state.dataListRoute);
    },

    // Thêm vào mutations trong store/index.ts
    RESET_SPECIFIC_ROUTE(state: any, routeId: number | string) {
      state.dataListRoute = state.dataListRoute.map((route: any) => {
        if (String(route.routeId) !== String(routeId)) return route;

        return {
          ...route,
          routeDetails: route.routeDetails.map((detail: any) => ({
            ...detail,
            status: 0 // Ép tất cả về 0
          }))
        };
      });

      // Lưu xuống SQLite ngay để đồng bộ
      storageService.set('list_route', state.dataListRoute);
      console.log("Store: Đã reset lộ trình về 0");
    },

    // Dùng để dọn sạch bộ nhớ RAM khi người dùng bấm Đăng Xuất
    CLEAR_ALL_DATA(state) {
      state.dataMenu = []
      state.dataListCP = []
      state.dataCheckpointsId = []
      state.dataAreaBU = []
      state.dataListRoute = []
      state.dataBasePointReportView = []
      state.dataReportNoteCategory = []
      state.dataUser = null
      state.dataScanQr = null
      state.token = null
      state.currentTime = null
      state.isHydrated = false
      state.routeId = null
      state.syncProgress = 0
      state.syncMessage = ''
      state.isSyncing = false
      state.currentCheckpoint = null
    }
  },

  // 4. Actions: Xử lý bất đồng bộ (API call) rồi gọi mutation
  actions: {
    async syncAllData({ commit }, apiList) {
      console.log('Bắt đầu đồng bộ Vuex...');

      // Thêm key 'mutation' để mapping tự động từ API -> SQLite -> Vuex
      const steps = [
        { name: 'CheckPoints', key: 'checkpoints', isLarge: false, mutation: 'SET_DATACP' },
        { name: 'CheckPointsId', key: 'checkpoints_id', isLarge: false, mutation: 'SET_DATA_CHECKPOINTS_ID' },
        { name: 'AreaBU', key: 'area_bu', isLarge: false, mutation: 'SET_DATA_AREA_BU' },
        { name: 'ListRoute', key: 'list_route', isLarge: false, mutation: 'SET_DATA_LIST_ROUTE' },
        { name: 'ReportNoteCategory', key: 'report_note_category', isLarge: false, mutation: 'SET_DATA_REPORT_NOTE_CATEGORY' },
        { name: 'BasePointReportView', key: 'base_point_report', isLarge: false, mutation: 'SET_DATA_BASE_POINT_REPORT_VIEW' },
      ];

      commit('SET_SYNC_STATUS', { progress: 0, message: 'Khởi động đồng bộ...', isSyncing: true });

      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const progress = Math.round((i / steps.length) * 100);

        commit('SET_SYNC_STATUS', {
          progress,
          message: `Đang tải ${step.name}...`,
          isSyncing: true
        });

        try {
          const apiFunc = apiList[step.key];
          if (typeof apiFunc !== 'function') {
            console.warn(`Không tìm thấy hàm API cho key: ${step.key}`);
            continue;
          }

          const response = await apiFunc();
          const data = response?.data;

          if (!data) {
            console.warn(`Dữ liệu của ${step.name} trả về null/undefined`);
            continue;
          }

          // 1. LƯU VÀO SQLITE
          if (step.isLarge && Array.isArray(data)) {
            await Promise.all(data.map(item => {
              const id = item.id || item.cpId || item.prId || item.userCode;
              return storageService.set(`${step.key}_${id}`, item);
            }));
          } else {
            await storageService.set(step.key, data);
          }

          // 2. TỰ ĐỘNG COMMIT LÊN VUEX STATE
          if (step.mutation) {
            commit(step.mutation, data);
          }

        } catch (error) {
          console.error(`Lỗi tại bước ${step.name}:`, error);
        }
      }

      commit('SET_SYNC_STATUS', { progress: 100, message: 'Đồng bộ hoàn tất!', isSyncing: false });
    },

    // Hàm khôi phục khóa từ Storage
    async restoreUnfinishedRouteId({ commit }) {
      const id = await storageService.get('unfinished_route_id');
      if (id) {
        commit('SET_UNFINISHED_ROUTE_ID', Number(id));
        console.log('✅ Đã khôi phục khóa lộ trình dở dang:', id);
      }
    },

    async initApp({ dispatch, commit }) {
      console.log('--- [START] Khởi tạo ứng dụng ---');
      try {
        await Promise.all([
          dispatch('restoreToken'),
          dispatch('restoreUser'),
        ]);

        const businessData = [
          'restoreMenu',
          'restoreCheckpoints',
          'restoreCheckpointsId',
          'restoreAreaBU',
          'restoreListRoute',
          'restoreRouteId',
          'restoreUnfinishedRouteId', // THÊM DÒNG NÀY VÀO LIST
          'restoreReportNoteCategory',
          'restoreBasePointReportView',
          'restoreScanQr'
        ];

        for (const action of businessData) {
          await dispatch(action);
        }
      } catch (e) {
        console.error("Lỗi khi khởi tạo Store:", e);
      } finally {
        commit('SET_HYDRATED', true);
        console.log('--- [END] Khởi tạo ứng dụng hoàn tất ---');
      }
    },

    // --- CÁC HÀM RESTORE TỪ SQLITE LÊN VUEX KHI F5 ---
    async restoreBasePointReportView({ commit, state }) {
      if (!state.dataBasePointReportView || state.dataBasePointReportView.length === 0) {
        let response = await storageService.get('base_point_report');

        if (typeof response === 'string') {
          try { response = JSON.parse(response); } catch (e) { }
        }

        const actualData = response?.data ? response.data : response;

        if (actualData) {
          commit('SET_DATA_BASE_POINT_REPORT_VIEW', actualData);
          console.log('✅ ĐÃ BƠM BASE_POINT_REPORT_VIEW VÀO VUEX:', actualData);
        }
      }
    },

    // --- CÁC HÀM RESTORE TỪ SQLITE LÊN VUEX KHI F5 ---
    async restoreCheckpoints({ commit, state }) {
      if (!state.dataListCP || state.dataListCP.length === 0) {
        let response = await storageService.get('checkpoints');

        // Đề phòng SQLite trả về chuỗi JSON thô
        if (typeof response === 'string') {
          try { response = JSON.parse(response); } catch (e) { }
        }

        const actualData = response?.data ? response.data : response;

        if (actualData) {
          commit('SET_DATACP', actualData);
          // THÊM DÒNG NÀY ĐỂ CHỨNG MINH DỮ LIỆU ĐÃ LÊN VUEX THÀNH CÔNG
          console.log('✅ ĐÃ BƠM DATACP VÀO VUEX:', actualData);
        }
      }
    },

    async restoreCheckpointsId({ commit, state }) {
      if (!state.dataCheckpointsId || state.dataCheckpointsId.length === 0) {
        let response = await storageService.get('checkpoints_id');

        console.log(response);

        // Đề phòng SQLite trả về chuỗi JSON thô
        if (typeof response === 'string') {
          try { response = JSON.parse(response); } catch (e) { }
        }

        const actualData = response?.data ? response.data : response;

        if (actualData) {
          commit('SET_DATA_CHECKPOINTS_ID', actualData);
          // THÊM DÒNG NÀY ĐỂ CHỨNG MINH DỮ LIỆU ĐÃ LÊN VUEX THÀNH CÔNG
          console.log('✅ ĐÃ BƠM CHECKPOINTS_ID VÀO VUEX:', actualData);
        }
      }
    },

    async restoreAreaBU({ commit, state }) {
      if (!state.dataAreaBU || state.dataAreaBU.length === 0) {
        let response = await storageService.get('area_bu');

        // Đề phòng SQLite trả về chuỗi JSON thô
        if (typeof response === 'string') {
          try { response = JSON.parse(response); } catch (e) { }
        }

        const actualData = response?.data ? response.data : response;

        if (actualData) {
          commit('SET_DATA_AREA_BU', actualData);
          // THÊM DÒNG NÀY ĐỂ CHỨNG MINH DỮ LIỆU ĐÃ LÊN VUEX THÀNH CÔNG
          console.log('✅ ĐÃ BƠM AREA_BU VÀO VUEX:', actualData);
        }
      }
    },

    async restoreReportNoteCategory({ commit, state }) {
      if (!state.dataReportNoteCategory || state.dataReportNoteCategory.length === 0) {
        let response = await storageService.get('report_note_category');

        // Đề phòng SQLite trả về chuỗi JSON thô
        if (typeof response === 'string') {
          try { response = JSON.parse(response); } catch (e) { }
        }

        const actualData = response?.data ? response.data : response;

        if (actualData) {
          commit('SET_DATA_REPORT_NOTE_CATEGORY', actualData);
          // THÊM DÒNG NÀY ĐỂ CHỨNG MINH DỮ LIỆU ĐÃ LÊN VUEX THÀNH CÔNG
          console.log('✅ ĐÃ BƠM REPORT_NOTE_CATEGORY VÀO VUEX:', actualData);
        }
      }
    },

    async restoreListRoute({ commit, state }) {
      try {
        const response = await storageService.get('list_route');
        if (response) {
          // Bóc tách dữ liệu: 
          // Trường hợp 1: response là mảng [{}, {}]
          // Trường hợp 2: response là { data: [{}, {}] }
          // Trường hợp 3: response là { data: { data: [] } } (đôi khi API bọc 2 lần)
          let actualData = response;
          if (response.data) {
            actualData = Array.isArray(response.data) ? response.data : (response.data.data || []);
          }

          if (Array.isArray(actualData)) {
            commit('SET_DATA_LIST_ROUTE', actualData);
            console.log('✅ Restore List Route thành công:', actualData);
          } else {
            console.warn('Dữ liệu List Route không phải là mảng:', actualData);
          }
        }
      } catch (error) {
        console.error("Lỗi khi restore List Route:", error);
      }
    },

    async restoreMenu({ commit, state }) {
      if (!state.dataMenu || state.dataMenu.length === 0) {
        const data = await storageService.get('menu_data');
        if (data) commit('SET_DATAMENU', data);
      }
    },

    async restoreToken({ commit, state }) {
      if (!state.token) {
        const data = await storageService.get('user_token');
        if (data) commit('SET_TOKEN', data);
        else commit('SET_TOKEN', null);
      }
    },

    async restoreScanQr({ commit, state }) {
      if (!state.dataScanQr) {
        let response = await storageService.get('data_scanqr');

        // Đề phòng parse chuỗi JSON
        if (typeof response === 'string') {
          try { response = JSON.parse(response); } catch (e) { }
        }

        // BÓC TÁCH AN TOÀN TRƯỚC KHI ĐẨY VÀO VUEX
        const actualData = response?.data ? response.data : response;

        if (actualData) commit('SET_DATASCANQR', actualData);
      }
    },

    async restoreUser({ commit, state }) {
      if (!state.dataUser) {
        let response = await storageService.get('user_data');

        // Đề phòng parse chuỗi JSON
        if (typeof response === 'string') {
          try { response = JSON.parse(response); } catch (e) { }
        }

        // BÓC TÁCH AN TOÀN TRƯỚC KHI ĐẨY VÀO VUEX
        const actualData = response?.data ? response.data : response;
        if (actualData) commit('SET_DATAUSER', actualData);
      }
    },

    async restoreCurrentTime({ commit, state }) {
      if (!state.currentTime) {
        const data = await storageService.get('currentTime');
        if (data) commit('SET_CURRENT_TIME', data);
      }
    },

    async restoreLastCheckpoint({ commit }) {
      try {
        const data = await storageService.get('last_selected_checkpoint');
        if (data) commit('SET_CURRENT_CHECKPOINT', data);
      } catch (e) {
        console.error("Error restoring checkpoint:", e);
      }
    },

    async restoreRouteId({ commit, state }) {
      if (!state.routeId) {
        const data = await storageService.get('current_route_id');
        if (data) commit('SET_ROUTE_ID', data);
      }
    },

    async resetCurrentRoute({ commit, state }) {
      try {
        commit('RESET_ROUTE_DATA'); // Mutation này của bạn đã set unfinishedRouteId = null rồi, rất tốt.

        // Xóa tất cả các khóa cứng trong Storage
        await Promise.all([
          storageService.remove('current_route_id'),
          storageService.remove('unfinished_route_id'), // Thêm dòng này
          storageService.remove('data_scanqr'),
        ]);

        const updatedList = state.dataListRoute;
        await storageService.set('list_route', updatedList);

        console.log('✅ Đã xóa lộ trình và reset trạng thái thành công');
      } catch (error) {
        console.error('Lỗi khi reset lộ trình:', error);
      }
    },
  }
})

export default store;