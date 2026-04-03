import { createStore } from 'vuex'
import storageService from '@/services/storage.service'
import { markRaw } from 'vue';
import i18n from '@/i18n';
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
  getters: {},

  // 3. Mutations: Hàm đồng bộ duy nhất được phép thay đổi State
  mutations: {
    SET_SYNC_OFFLINE_STATUS(state, status) {
      state.isSyncingOffline = status;
    },
    SET_PSID(state, data) {
      state.psId = data
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

        // NẾU SERVER BÁO CA NÀY ĐÃ XONG (Từ máy 2), ÉP CHÍN TOÀN BỘ ĐIỂM BÊN TRONG THÀNH TRUE
        const isShiftDoneOnServer = apiRoute.isComplete === true;

        return {
          ...apiRoute,
          areaId: Number(apiRoute.areaId),
          roleId: Number(apiRoute.roleId),
          psHourFrom: Number(apiRoute.psHourFrom),
          psHourTo: Number(apiRoute.psHourTo),
          routeDetails: apiRoute.routeDetails.map((apiPoint: any) => {
            const localPoint = localRoute?.routeDetails.find((p: any) => p.cpId === apiPoint.cpId);

            // Chỉ cần Server báo XONG (1) hoặc Local báo XONG (1) thì chắc chắn là XONG. 
            const isDone = isShiftDoneOnServer || apiPoint.rdIsComplete === true || apiPoint.status === 1 ||
              localPoint?.rdIsComplete === true || localPoint?.status === 1;

            return {
              ...apiPoint,
              rdIsComplete: isDone ? true : apiPoint.rdIsComplete,
              status: isDone ? 1 : (apiPoint.status || 0)
            };
          })
        };
      });

      let mergedList = [...mappedApiData];

      // 2. GIỮ LẠI CA CŨ LOCAL NẾU SERVER KHÔNG CÒN TRẢ VỀ
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

      // 3. TỰ ĐỘNG GỠ KHÓA VÀ DỌN RÁC DỰA VÀO PSID (ĐÍCH DANH CA TRỰC)
      if (state.unfinishedRouteId) {
        const lockedId = Number(state.unfinishedRouteId);
        const lockedPsId = state.psId ? Number(state.psId) : null;

        let exactServerRoute;
        if (lockedPsId) {
          // Phải tìm đích danh theo psId để không nhầm qua ca khác trong ngày
          exactServerRoute = mappedApiData.find((r: any) => Number(r.psId) === lockedPsId);
        } else {
          // Fallback (Trường hợp rất hiếm): Nếu chưa có psId thì tìm theo lộ trình
          exactServerRoute = mappedApiData.find((r: any) => Number(r.routeId) === lockedId);
        }

        const isStillOnServer = !!exactServerRoute;

        let isDoneOnServer = false;
        if (exactServerRoute) {
          isDoneOnServer = exactServerRoute.isComplete === true ||
            (exactServerRoute.routeDetails.length > 0 && exactServerRoute.routeDetails.every((p: any) => p.rdIsComplete));
        }

        // Tìm ca này ở Local xem đã đi full chưa
        const exactLocalRoute = state.dataListRoute.find((r: any) =>
          Number(r.routeId) === lockedId && (lockedPsId ? Number(r.psId) === lockedPsId : true)
        );
        const isAllDoneLocal = exactLocalRoute ? exactLocalRoute.routeDetails.every((p: any) => p.rdIsComplete) : false;

        // TIẾN HÀNH GỠ KHÓA VÀ XÓA BÓNG MA
        if (isAllDoneLocal || isDoneOnServer || !isStillOnServer) {
          console.log(
            isDoneOnServer ? "Máy khác đã hoàn thành ca này trên Server. Gỡ khóa!" :
              isAllDoneLocal ? "Local báo đã đi xong. Gỡ khóa!" :
                "Đã lố ca, Server chuyển ca mới. Gỡ khóa ca cũ!"
          );

          // 3.1 Xóa khóa trong RAM
          state.unfinishedRouteId = null;
          state.routeId = null;
          state.psId = null;
          state.dataScanQr = null;

          // 3.2 Xóa khóa trong Ổ cứng
          storageService.remove('unfinished_route_id');
          storageService.remove('current_route_id');
          storageService.remove('current_ps_id');
          storageService.remove('data_scanqr');

          // 3.3 QUAN TRỌNG: TIÊU DIỆT BÓNG MA Ở MÁY 1 (Cái bản 3/19 hư hỏng)
          if (lockedPsId) {
            state.dataListRoute = state.dataListRoute.filter((r: any) => Number(r.psId) !== lockedPsId);
          } else {
            state.dataListRoute = state.dataListRoute.filter((r: any) => Number(r.routeId) !== lockedId);
          }

          // 3.4 BƠM LẠI SỰ THẬT TỪ SERVER: Nếu Server báo đã xong, lấy bản hoàn hảo (19/19) nhét lại vào Local
          if (isDoneOnServer && exactServerRoute) {
            state.dataListRoute.push(exactServerRoute);
          }

        } else {
          // Nếu chưa xong và vẫn còn giờ, duy trì khóa psId
          if (!state.psId && exactLocalRoute && exactLocalRoute.psId) {
            state.psId = exactLocalRoute.psId;
          }
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

        // 3. BẢO VỆ PSID: Chỉ tự động tìm và gán cứng psId NẾU NÓ CHƯA TỒN TẠI
        if (!state.psId) {
          if (Array.isArray(state.dataListRoute)) {
            const found = state.dataListRoute.find((r: any) => Number(r.routeId) === Number(id));
            if (found && found.psId) {
              state.psId = found.psId;
              storageService.set('current_ps_id', found.psId);
              console.log("Đã tự động cập nhật & khóa cứng psId:", state.psId);
            }
          }
        } else {
          // Đảm bảo lưu cứng lại psId chuẩn hiện tại xuống máy
          storageService.set('current_ps_id', state.psId);
        }
      } else {
        storageService.remove('unfinished_route_id');
        storageService.remove('current_ps_id');
      }
    },

    // Cập nhật lại RESET_ROUTE_DATA để xóa cả khóa cứng
    RESET_ROUTE_DATA(state: any) {
      state.routeId = null;
      state.unfinishedRouteId = null;
      state.psId = null;
      state.dataScanQr = null;

      if (Array.isArray(state.dataListRoute)) {
        state.dataListRoute = state.dataListRoute.map((route: any) => ({
          ...route,
          routeDetails: route.routeDetails.map((point: any) => ({
            ...point,
            status: 0,
            rdIsComplete: false
          }))
        }));
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
        // Gọi logic khóa ID
        state.unfinishedRouteId = routeId;
        storageService.set('unfinished_route_id', routeId);

        // BẢO VỆ PSID
        if (!state.psId) {
          const found = state.dataListRoute.find((r: any) => Number(r.routeId) === Number(routeId));
          if (found) {
            state.psId = found.psId;
            storageService.set('current_ps_id', found.psId);
          }
        }
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

    // Thêm vào mutations trong store/index.ts
    RESET_SPECIFIC_ROUTE(state: any, routeId: number | string) {
      state.dataListRoute = state.dataListRoute.map((route: any) => {
        if (String(route.routeId) !== String(routeId)) return route;

        return {
          ...route,
          routeDetails: route.routeDetails.map((detail: any) => ({
            ...detail,
            status: 0,
            rdIsComplete: false
          }))
        };
      });

      // Lưu xuống SQLite ngay để đồng bộ
      storageService.set('list_route', state.dataListRoute);
      console.log("Store: Đã reset lộ trình về 0");
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
              // Chỉ lưu SQLite 1 lần và BẮT BUỘC CÓ AWAIT để máy ghi xong mới đi tiếp
              await storageService.set(step.key, data);

              // Xóa bỏ các khối if (data) lồng nhau lặp code
              requestAnimationFrame(() => {
                commit(step.mutation, data);
              });
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

      // Giữ màn hình Hoàn Tất 1.5s trước khi đóng
      setTimeout(() => {
        commit('SET_SYNC_STATUS', { progress: 0, message: '', isSyncing: false, mode: 'silent' });
      }, 1500);
    },

    // Hàm khôi phục khóa từ Storage
    async restoreUnfinishedRouteId({ commit }) {
      const id = await storageService.get('unfinished_route_id');
      if (id) {
        commit('SET_UNFINISHED_ROUTE_ID', Number(id));
        console.log('Đã khôi phục khóa lộ trình dở dang:', id);
      } else {
        // CHỐT CHẶN AN TOÀN TỐI ĐA: 
        // Nếu bộ nhớ máy (SQLite) không có khóa, ép Vuex phải rỗng để chắc chắn không bị khóa oan
        commit('SET_UNFINISHED_ROUTE_ID', null);
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
          // 'restoreCheckpointsId',
          'restoreAreaBU',
          'restoreRouteId',
          'restoreUnfinishedRouteId',
          'restorePsId',
          'restoreListRoute',
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
          console.log('ĐÃ BƠM BASE_POINT_REPORT_VIEW VÀO VUEX:', actualData);
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
          console.log('ĐÃ BƠM DATACP VÀO VUEX:', actualData);
        }
      }
    },

    // async restoreCheckpointsId({ commit, state }) {
    //   if (!state.dataCheckpointsId || state.dataCheckpointsId.length === 0) {
    //     let response = await storageService.get('checkpoints_id');

    //     console.log(response);

    //     if (typeof response === 'string') {
    //       try { response = JSON.parse(response); } catch (e) { }
    //     }

    //     const actualData = response?.data ? response.data : response;

    //     if (actualData) {
    //       commit('SET_DATA_CHECKPOINTS_ID', actualData);
    //       console.log('ĐÃ BƠM CHECKPOINTS_ID VÀO VUEX:', actualData);
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
          console.log('ĐÃ BƠM AREA_BU VÀO VUEX:', actualData);
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
          console.log('ĐÃ BƠM REPORT_NOTE_CATEGORY VÀO VUEX:', actualData);
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
            console.log('Restore List Route thành công:', actualData);
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
        commit('RESET_ROUTE_DATA');

        // Xóa tất cả các khóa cứng trong Storage
        await Promise.all([
          storageService.remove('current_route_id'),
          storageService.remove('unfinished_route_id'),
          storageService.remove('current_ps_id'),
          storageService.remove('data_scanqr'),
        ]);

        const updatedList = state.dataListRoute;
        await storageService.set('list_route', updatedList);

        console.log('Đã xóa lộ trình và reset trạng thái thành công');
      } catch (error) {
        console.error('Lỗi khi reset lộ trình:', error);
      }
    },

    async restorePsId({ commit, state }) {
      if (!state.psId) {
        const data = await storageService.get('current_ps_id');
        if (data) commit('SET_PSID', data);
      }
    },

    async logout({ commit }) {
      console.log('--- [LOGOUT] Đang dọn dẹp dữ liệu ---');

      // 1. BẢO LƯU DANH SÁCH TÀI KHOẢN OFFLINE TRƯỚC KHI XÓA
      let offlineUsers = null;
      try {
        offlineUsers = await storageService.get('offline_users_dict');
      } catch (e) {
        console.error("Không lấy được danh sách offline trước khi xóa", e);
      }

      // 2. Xóa sạch RAM
      commit('CLEAR_ALL_DATA');

      // 3. Xóa sạch Ổ CỨNG
      const keysToRemove = [
        'user_token',
        'user_data',
        'current_route_id',
        'unfinished_route_id',
        'current_ps_id',
        'data_scanqr',
      ];

      for (const key of keysToRemove) {
        await storageService.remove(key);
      }

      // 4. PHỤC HỒI LẠI DANH SÁCH TÀI KHOẢN OFFLINE
      if (offlineUsers && Object.keys(offlineUsers).length > 0) {
        await storageService.set('offline_users_dict', offlineUsers);
        console.log('Đã phục hồi danh sách tài khoản Offline an toàn.');
      }

      console.log('Đã dọn dẹp xong RAM và SQLite.');
    }
  }
})

export default store;