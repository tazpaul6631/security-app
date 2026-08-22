import { createStore } from 'vuex'
import storageService from '@/services/storage.service'
import { markRaw } from 'vue';
import i18n from '@/i18n';
import { findActiveRoute, isPatrolSessionValid, isRouteUnfinished } from '@/composables/usePatrolSession';
import { ImageService } from '@/services/image.service';
import { isSendDataInFlight, waitForSendDataIdle } from '@/composables/useOfflineManager';
const { t } = (i18n.global as any);

const store = createStore({

  // 1. State: Chứa dữ liệu
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

      syncProgress: 0,
      syncMessage: '',
      isOnline: true,
      isSyncing: false,

      currentCheckpoint: null,
      syncMode: 'silent',
      isSyncingOffline: false,
    }
  },

  // 2. Getters: Tính toán dữ liệu từ state (giống computed)
  getters: {
    activeRoute: (state) => findActiveRoute(state),
    isPatrolSessionValid: (state) => isPatrolSessionValid(state),
    isRouteUnfinished: (state) => isRouteUnfinished(state),
  },

  // 3. Mutations: Hàm đồng bộ duy nhất được phép thay đổi State
  mutations: {
    SET_SYNC_OFFLINE_STATUS(state, status) {
      state.isSyncingOffline = status;
    },
    SET_PSID(state, data) {
      state.psId = data
      if (data) {
        storageService.set('current_ps_id', data);
      } else {
        storageService.remove('current_ps_id');
      }
    },
    SET_DATAMENU(state, data) {
      if (JSON.stringify(state.dataMenu) === JSON.stringify(data)) return;
      state.dataMenu = data;
    },
    SET_DATACP(state, data) {
      state.dataListCP = markRaw(data)
    },
    // SET_DATA_CHECKPOINTS_ID(state, data) {
    //   state.dataCheckpointsId = markRaw(data)
    // },
    SET_DATA_AREA_BU(state, data) {
      state.dataAreaBU = markRaw(data)
    },
    SET_DATA_LIST_ROUTE(state: any, data) {
      const apiData = Array.isArray(data) ? data : (data?.data || []);
      const localRoutes = state.dataListRoute || [];

      // 1. MAP VÀ GỘP DỮ LIỆU
      const mappedApiData = apiData.map((apiRoute: any) => {
        const localRoute = localRoutes.find((r: any) =>
          Number(r.routeId) === Number(apiRoute.routeId) &&
          Number(r.psId) === Number(apiRoute.psId)
        );

        const isShiftDoneOnServer = apiRoute.isComplete === true;

        // Đánh giá từng điểm quét
        const mergedDetails = apiRoute.routeDetails.map((apiPoint: any) => {
          const localPoint = localRoute?.routeDetails.find((p: any) => p.cpId === apiPoint.cpId);

          // Nếu Server HOẶC Local báo điểm này đã quét (1), thì điểm này CHẮC CHẮN ĐÃ QUÉT
          const isDone = isShiftDoneOnServer ||
            apiPoint.status === 1 || apiPoint.rdIsComplete === true ||
            localPoint?.status === 1 || localPoint?.rdIsComplete === true;

          return {
            ...apiPoint,
            rdIsComplete: isDone,
            status: isDone ? 1 : (apiPoint.status || 0)
          };
        });

        // Tự động kiểm tra: Nếu tất cả các điểm đã xanh, ép ca này thành isComplete = true ngay lập tức
        const isAllPointsDone = mergedDetails.length > 0 && mergedDetails.every((p: any) => p.rdIsComplete);

        return {
          ...apiRoute,
          areaId: Number(apiRoute.areaId),
          roleId: Number(apiRoute.roleId),
          psHourFrom: Number(apiRoute.psHourFrom),
          psHourTo: Number(apiRoute.psHourTo),
          isComplete: isShiftDoneOnServer || isAllPointsDone, // Cập nhật trạng thái hoàn thành thực tế
          routeDetails: mergedDetails
        };
      });

      // 2. GIỮ LẠI CA CŨ LOCAL NẾU SERVER KHÔNG CÒN TRẢ VỀ
      let mergedList = [...mappedApiData];
      localRoutes.forEach((localR: any) => {
        const isInApi = mergedList.some((apiR: any) =>
          Number(apiR.routeId) === Number(localR.routeId) &&
          Number(apiR.psId) === Number(localR.psId)
        );
        if (!isInApi) {
          mergedList.push(localR);
        }
      });

      state.dataListRoute = mergedList;

      // 3. XỬ LÝ GỠ KHÓA (KHÔNG XÓA DỮ LIỆU)
      if (state.unfinishedRouteId) {
        const lockedId = Number(state.unfinishedRouteId);
        const lockedPsId = state.psId ? Number(state.psId) : null;

        // Tìm chính xác ca đang bị khóa — bắt buộc khớp cả routeId và psId
        const lockedRouteInList = lockedPsId
          ? state.dataListRoute.find((r: any) =>
            Number(r.routeId) === lockedId && Number(r.psId) === lockedPsId
          )
          : null;

        // NẾU: Ca đó đã được đánh dấu xong (isComplete = true) HOẶC không tìm thấy -> GỠ KHÓA AN TOÀN
        if (!lockedRouteInList || lockedRouteInList.isComplete) {
          // Chỉ xóa khóa, KHÔNG xóa dữ liệu khỏi mảng dataListRoute
          state.unfinishedRouteId = null;
          state.routeId = null;
          state.psId = null;
          state.dataScanQr = null;

          storageService.remove('unfinished_route_id');
          storageService.remove('current_route_id');
          storageService.remove('current_ps_id');
          storageService.remove('data_scanqr');
        }
      }
    },
    SET_DATA_BASE_POINT_REPORT_VIEW(state: any, data) {
      const rawData = Array.isArray(data) ? data : (data?.data || []);
      state.dataBasePointReportView = markRaw(rawData.map((route: any) => ({ ...route })));
    },
    SET_DATAUSER(state, data) {
      // CHỈ GÁN KHI DỮ LIỆU THỰC SỰ KHÁC BIỆT
      if (JSON.stringify(state.dataUser) === JSON.stringify(data)) return;
      state.dataUser = data;
    },
    SET_DATASCANQR(state, data) {
      state.dataScanQr = data
    },
    SET_TOKEN(state, data) {
      // Tránh ghi đè token giống hệt nhau làm Router kích hoạt lại Navigation Guard
      if (state.token === data) return;
      state.token = data;
    },
    SET_CURRENT_TIME(state, data) {
      state.currentTime = data
    },
    SET_HYDRATED(state, data) {
      // Nếu đã hydrated rồi thì không cho phép set về false nữa (trừ khi logout)
      if (state.isHydrated && data === false) return;
      state.isHydrated = data;
    },
    SET_ROUTE_ID(state, id) {
      state.routeId = id
    },
    SET_DATA_REPORT_NOTE_CATEGORY(state, data) {
      state.dataReportNoteCategory = markRaw(data)
    },
    SET_NETWORK_STATUS(state, status) {
      // Chỉ cập nhật nếu thực sự thay đổi từ true sang false hoặc ngược lại
      if (state.isOnline === status) return;
      state.isOnline = status;
    },
    SET_SYNC_STATUS(state, { progress, message, isSyncing, mode = 'silent' }) {
      // Chỉ cập nhật nếu giá trị thực sự thay đổi
      if (state.isSyncing === isSyncing && state.syncProgress === progress && state.syncMessage === message) {
        return;
      }
      state.syncProgress = progress;
      state.syncMessage = message;
      state.isSyncing = isSyncing;
      state.syncMode = mode;
    },
    SET_CURRENT_CHECKPOINT(state, data) {
      state.currentCheckpoint = data;
    },

    SET_UNFINISHED_ROUTE_ID(state: any, id: any) {
      state.unfinishedRouteId = id;
      if (id) {
        // 1. Lưu khóa dở dang
        storageService.set('unfinished_route_id', id);

        // 2. ÉP LUÔN routeId hiện tại thành ID này (Đồng bộ tuyệt đối)
        state.routeId = id;
        storageService.set('current_route_id', id);
      } else {
        storageService.remove('unfinished_route_id');
        storageService.remove('current_route_id');
      }
    },

    // Reset chỉ ca trực (routeId + psId) đang hủy — không ảnh hưởng ca khác
    RESET_ROUTE_DATA(state: any, payload?: { routeId?: number | string; psId?: number | string }) {
      const targetRouteId = payload?.routeId ?? state.unfinishedRouteId ?? state.routeId;
      const targetPsId = payload?.psId ?? state.psId;

      state.routeId = null;
      state.unfinishedRouteId = null;
      state.psId = null;
      state.dataScanQr = null;

      if (targetRouteId != null && targetPsId != null && Array.isArray(state.dataListRoute)) {
        state.dataListRoute = state.dataListRoute.map((route: any) => {
          if (
            Number(route.routeId) !== Number(targetRouteId) ||
            Number(route.psId) !== Number(targetPsId)
          ) {
            return route;
          }
          return {
            ...route,
            isComplete: false,
            routeDetails: route.routeDetails.map((point: any) => ({
              ...point,
              status: 0,
              rdIsComplete: false
            }))
          };
        });
      }
    },

    // Hàm bơm báo cáo Offline giả vào Store
    ADD_OFFLINE_REPORT(state: any, report: any) {
      // 1. Nhét vào kho tổng CheckpointsId (Bây giờ nó chắc chắn là Mảng)
      let allReports = Array.isArray(state.dataCheckpointsId) ? state.dataCheckpointsId : [];

      // Đẩy báo cáo mới lên đầu mảng và gán thẳng lại (Không cần .data nữa)
      state.dataCheckpointsId = [report, ...allReports];

      // 2. Nhét trực tiếp vào màn hình CPIndex hiện tại (nếu đang xem đúng khu vực đó)
      let currentCPList = [];
      if (Array.isArray(state.dataListCP)) {
        currentCPList = state.dataListCP[0]?.data || state.dataListCP;
      } else {
        currentCPList = state.dataListCP?.data || [];
      }

      // Nếu danh sách rỗng hoặc cpId trùng với màn hình đang xem thì bơm vào UI
      if (currentCPList.length === 0 || String(currentCPList[0]?.cpId) === String(report.cpId)) {
        currentCPList = [report, ...currentCPList];
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
        state.unfinishedRouteId = routeId;
        storageService.set('unfinished_route_id', routeId);
      }

      state.dataListRoute = state.dataListRoute.map((route: any) => {
        // QUAN TRỌNG: Cập nhật status điểm quét phải khớp CẢ routeId VÀ psId
        if (Number(route.routeId) !== Number(routeId) || Number(route.psId) !== Number(state.psId)) {
          return route;
        }

        const newDetails = route.routeDetails.map((detail: any) => {
          if (Number(detail.cpId) === Number(cpId)) {
            // Cập nhật cả 2 biến để giao diện nhận diện được
            return { ...detail, status: status, rdIsComplete: status === 1 };
          }
          return detail;
        });
        return { ...route, routeDetails: newDetails };
      });

      storageService.set('list_route', state.dataListRoute);
    },

    RESET_SPECIFIC_ROUTE(state: any, { routeId, psId }: { routeId: number | string; psId: number | string }) {
      state.dataListRoute = state.dataListRoute.map((route: any) => {
        if (
          Number(route.routeId) !== Number(routeId) ||
          Number(route.psId) !== Number(psId)
        ) {
          return route;
        }

        return {
          ...route,
          isComplete: false,
          routeDetails: route.routeDetails.map((detail: any) => ({
            ...detail,
            status: 0,
            rdIsComplete: false
          }))
        };
      });

      storageService.set('list_route', state.dataListRoute);
    },

    // Dùng để dọn sạch bộ nhớ RAM khi người dùng bấm Đăng Xuất
    CLEAR_ALL_DATA(state) {
      state.dataMenu = [];
      state.dataListCP = [];
      state.dataCheckpointsId = [];
      state.dataAreaBU = [];
      state.dataListRoute = [];
      state.dataBasePointReportView = [];
      state.dataReportNoteCategory = [];
      state.dataUser = null;
      state.dataScanQr = null;
      state.token = null;
      state.currentTime = null;
      state.isHydrated = false;
      state.routeId = null;
      state.psId = null;
      state.unfinishedRouteId = null;
      state.syncProgress = 0;
      state.syncMessage = '';
      state.isSyncing = false;
      state.currentCheckpoint = null;
      state.isSyncingOffline = false;
      state.syncMode = 'silent';
    }
  },

  // 4. Actions: Xử lý bất đồng bộ (API call) rồi gọi mutation
  actions: {
    async syncAllData({ commit, state }, { apiList, mode = 'silent' }) {
      if (!apiList) return;

      // 1. Khởi động trạng thái đồng bộ
      commit('SET_SYNC_STATUS', {
        progress: 0,
        message: mode === 'overlay'
          ? t('messages.sync.loading_shift_data')
          : t('messages.sync.updating'),
        isSyncing: true,
        mode: mode
      });

      // Nhường luồng 100ms để trình duyệt kịp vẽ Overlay đen ra màn hình
      await new Promise(resolve => setTimeout(resolve, 100));

      const steps: any[] = [
        { name: t('messages.sync.steps.checkpoints'), key: 'checkpoints', mutation: 'SET_DATACP' },
        { name: t('messages.sync.steps.area_bu'), key: 'area_bu', mutation: 'SET_DATA_AREA_BU' },
        { name: t('messages.sync.steps.list_route'), key: 'list_route', mutation: 'SET_DATA_LIST_ROUTE' },
        { name: t('messages.sync.steps.report_note_category'), key: 'report_note_category', mutation: 'SET_DATA_REPORT_NOTE_CATEGORY' },
        { name: t('messages.sync.steps.base_point_report'), key: 'base_point_report', mutation: 'SET_DATA_BASE_POINT_REPORT_VIEW' }
      ];

      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const progress = Math.round(((i + 1) / steps.length) * 100);

        // Cập nhật text hiển thị và phần trăm trước khi tải
        if (mode === 'overlay' || i === steps.length - 1) {
          commit('SET_SYNC_STATUS', {
            progress,
            message: t('messages.sync.loading_step', { name: step.name }),
            isSyncing: true,
            mode: mode
          });

          // Nhường luồng 50ms để thanh Progress Bar trượt mượt mà
          await new Promise(resolve => setTimeout(resolve, 50));
        }

        try {
          const apiFunc = apiList[step.key];
          if (typeof apiFunc === 'function') {
            const response = await apiFunc();
            const data = response?.data;

            if (data) {
              // Commit trước (list_route sẽ merge với local), rồi mới ghi SQLite bản đã merge
              commit(step.mutation, data);

              if (step.key === 'list_route') {
                await storageService.set('list_route', state.dataListRoute);
              } else {
                await storageService.set(step.key, data);
              }
            }
          }
        } catch (error) {
          console.error(`Lỗi đồng bộ bước ${step.name}:`, error);
        }
      }

      // 2. Hoàn tất đồng bộ
      commit('SET_SYNC_STATUS', {
        progress: 100,
        message: t('messages.sync.completed'),
        isSyncing: true,
        mode: mode
      });

      // Giữ màn hình Hoàn Tất 1.5s rồi tắt — await để caller biết overlay đã xong
      await new Promise(resolve => setTimeout(resolve, 1500));
      commit('SET_SYNC_STATUS', { progress: 0, message: '', isSyncing: false, mode: 'silent' });
    },

    // Hàm khôi phục khóa từ Storage
    async restoreUnfinishedRouteId({ commit }) {
      const id = await storageService.get('unfinished_route_id');
      if (id) {
        commit('SET_UNFINISHED_ROUTE_ID', Number(id));
      } else {
        // CHỐT CHẶN AN TOÀN TỐI ĐA: 
        // Nếu bộ nhớ máy (SQLite) không có khóa, ép Vuex phải rỗng để chắc chắn không bị khóa oan
        commit('SET_UNFINISHED_ROUTE_ID', null);
      }
    },

    async initApp({ dispatch, commit }) {
      try {
        await Promise.all([
          dispatch('restoreToken'),
          dispatch('restoreUser'),
        ]);

        const businessData = [
          'restoreMenu',
          'restoreCheckpoints',
          // 'restoreCheckpointsId',
          'restoreAreaBU',
          'restoreListRoute',
          'restorePsId',
          'restoreRouteId',
          'restoreUnfinishedRouteId',
          'restoreReportNoteCategory',
          'restoreBasePointReportView',
          'restoreScanQr',
        ];

        for (const action of businessData) {
          await dispatch(action);
        }
      } catch (e) {
        console.error("Lỗi khi khởi tạo Store:", e);
      } finally {
        commit('SET_HYDRATED', true);
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
        }
      }
    },

    // async restoreCheckpointsId({ commit, state }) {
    //   if (!state.dataCheckpointsId || state.dataCheckpointsId.length === 0) {
    //     let response = await storageService.get('checkpoints_id');

    //     if (typeof response === 'string') {
    //       try { response = JSON.parse(response); } catch (e) { }
    //     }

    //     const actualData = response?.data ? response.data : response;

    //     if (actualData) {
    //       commit('SET_DATA_CHECKPOINTS_ID', actualData);
    //     }
    //   }
    // },

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
        }
      }
    },

    async restoreListRoute({ commit, state }) {
      try {
        let response = await storageService.get('list_route');

        if (typeof response === 'string') {
          try { response = JSON.parse(response); } catch (e) { }
        }

        if (response) {
          let actualData = response;
          if (response.data) {
            actualData = Array.isArray(response.data) ? response.data : (response.data.data || []);
          }

          if (Array.isArray(actualData)) {
            commit('SET_DATA_LIST_ROUTE', actualData);
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
        const routeId = state.unfinishedRouteId ?? state.routeId;
        const psId = state.psId;

        commit('RESET_ROUTE_DATA', { routeId, psId });

        await Promise.all([
          storageService.remove('current_route_id'),
          storageService.remove('unfinished_route_id'),
          storageService.remove('current_ps_id'),
          storageService.remove('data_scanqr'),
          storageService.remove('currentTime_scanqr'),
        ]);

        await storageService.set('list_route', state.dataListRoute);

        const pendingQueue = (await storageService.get('offline_api_queue')) || [];
        if (pendingQueue.length === 0) {
          await ImageService.purgeOfflineImages();
        }
      } catch (error) {
        console.error('Lỗi khi reset lộ trình:', error);
      }
    },

    async restorePsId({ commit }) {
      const data = await storageService.get('current_ps_id');
      if (data) commit('SET_PSID', data);
    },

    async logout({ commit, state }) {
      const sendIdle = await waitForSendDataIdle(5000);
      if (!sendIdle || isSendDataInFlight()) {
        throw new Error('SEND_DATA_IN_FLIGHT');
      }

      // 1. BẢO LƯU DANH SÁCH TÀI KHOẢN OFFLINE + PATROL SHIFT LOGS TRƯỚC KHI XÓA
      let offlineUsers = null;
      let patrolShiftLogs = null;
      try {
        offlineUsers = await storageService.get('offline_users_dict');
        patrolShiftLogs = await storageService.get('patrol_shift_logs');
        const currentUser: any = state.dataUser;

        if (offlineUsers && currentUser?.userCode) {
          if (offlineUsers[currentUser.userCode]) {
            offlineUsers[currentUser.userCode].profile.accessToken = null;
          }
        }
      } catch (e) {
        console.error("Không lấy được dữ liệu cần giữ trước khi xóa", e);
      }

      // 2. Xóa sạch RAM
      commit('CLEAR_ALL_DATA');

      // 3. Xóa sạch toàn bộ SQLite (draft, timer, queue, checkpoint cache, ...)
      await storageService.clear();

      // 3b. Dọn ảnh offline còn sót trên Filesystem
      await ImageService.purgeOfflineImages();

      // 4. PHỤC HỒI LẠI DANH SÁCH TÀI KHOẢN OFFLINE
      if (offlineUsers && Object.keys(offlineUsers).length > 0) {
        await storageService.set('offline_users_dict', offlineUsers);
      }

      // 5. Giữ patrol_shift_logs — chỉ xóa khi syncPatrolLog success:true
      if (Array.isArray(patrolShiftLogs) && patrolShiftLogs.length > 0) {
        await storageService.set('patrol_shift_logs', patrolShiftLogs);
      }
    }
  }
})

export default store;