import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import { Store } from 'vuex';
import { Router } from 'vue-router';
import storageService from '@/services/storage.service';
import CheckPointScanQr from '@/api/CheckPointScanQr';
import { presentAlertToast } from '@/services/toast.service';
import ScanCpQrLog from '@/api/ScanCpQrLog';
import { useAppLoading } from '@/composables/useAppLoading';

const { show: showLoading, hide: hideLoading } = useAppLoading();

export type ProcessQRResult =
  | { code: 'WRONG_ORDER'; nextPointName: string }
  | void;

export const scannerService = {
  async requestPermissions() {
    const { camera } = await BarcodeScanner.requestPermissions();
    return camera === 'granted' || camera === 'limited';
  },

  async startScanning(store: Store<any>, router: Router, routeId: number, t: any): Promise<string | null> {
    const granted = await this.requestPermissions();
    if (!granted) {
      presentAlertToast(t('messages.scanner.notification'), '', t('messages.scanner.grant-camera-permission'));
      return null;
    }

    try {
      // 1. Kiểm tra xem máy đã có Google Barcode Module chưa
      const { available } = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();

      // 2. NẾU CHƯA CÓ -> Bật Loading báo hiệu và tiến hành tải
      if (!available) {
        showLoading('Đang khởi tạo máy quét (chỉ lần đầu)...');

        try {
          // Yêu cầu Google Play Services tải ngầm module
          await BarcodeScanner.installGoogleBarcodeScannerModule();
        } catch (installError) {
          console.error("Lỗi cài đặt module quét:", installError);
          presentAlertToast('Lỗi', '', 'Không thể tải module máy quét từ Google. Vui lòng kiểm tra mạng!');
          return null; // Chỉ return null nếu tải THẤT BẠI
        } finally {
          hideLoading();
        }
      }

      // 3. ĐÃ CÓ SẴN (Hoặc vừa tải xong) -> Chạy thẳng lệnh bật Camera!
      const { barcodes } = await BarcodeScanner.scan();

      if (!barcodes || barcodes.length === 0) return null;

      return barcodes[0].rawValue || null;

    } catch (error) {
      console.error("Camera scan error:", error);
      throw error;
    }
  },

  // 2. Hàm mới: Xử lý chuỗi QR (Bất kể chuỗi đó lấy từ Camera hay từ nút bấm Unitech)
  async processQRString(
    store: Store<any>,
    router: Router,
    routeId: number,
    qrCodeString: string,
    t: any
  ): Promise<ProcessQRResult> {
    const now = new Date();
    const currentTimeString = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().slice(0, 19);
    const dataListRoute = store.state.dataListRoute;

    await storageService.set('current_route_id', routeId);

    const targetPsId = store.state.psId;
    let currentRoute;

    if (targetPsId) {
      currentRoute = dataListRoute.find((r: any) =>
        Number(r.routeId) === Number(routeId) &&
        Number(r.psId) === Number(targetPsId)
      );
    }

    if (!currentRoute) {
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;
      const currentDay = now.getDate();
      const hNow = now.getHours();

      currentRoute = dataListRoute.find((r: any) => {
        if (Number(r.routeId) !== Number(routeId)) return false;

        const f = Number(r.psHourFrom);
        const tHour = Number(r.psHourTo);
        const isToday = (
          Number(r.psYear) === currentYear &&
          Number(r.psMonth) === currentMonth &&
          Number(r.psDay) === currentDay
        );

        let isMatchDateAndHour = false;

        if (f <= tHour) {
          isMatchDateAndHour = isToday && (hNow >= f && hNow <= tHour);
        } else {
          if (hNow >= f) {
            isMatchDateAndHour = isToday;
          } else if (hNow <= tHour) {
            const yesterday = new Date(now);
            yesterday.setDate(now.getDate() - 1);
            isMatchDateAndHour = (
              Number(r.psYear) === yesterday.getFullYear() &&
              Number(r.psMonth) === yesterday.getMonth() + 1 &&
              Number(r.psDay) === yesterday.getDate()
            );
          }
        }

        const isFinished = r.routeDetails.every((p: any) => p.rdIsComplete);
        return isMatchDateAndHour && !isFinished && !r.isComplete;
      });
    }

    if (!currentRoute) {
      presentAlertToast(t('messages.scanner.notification'), '', t('messages.scanner.route-not-found'));
      return;
    }

    const listScanQr = { cpwId: '', cpwCode: '' };

    if (qrCodeString) {
      try {
        const url = new URL(qrCodeString);
        const segments = url.pathname.split('/');
        listScanQr.cpwId = segments[3];
        listScanQr.cpwCode = segments[4];
      } catch (e) {
        presentAlertToast(t('messages.scanner.notification'), '', t('messages.scanner.invalid-qr-code'));
        return;
      }
    } else {
      return;
    }

    const nextPointRequired = currentRoute.routeDetails.find((point: any) => point.status !== 1);

    if (!nextPointRequired) {
      presentAlertToast(t('messages.scanner.notification'), '', t('messages.scanner.route-completed'));
      return;
    }

    const isIdMismatch = String(listScanQr.cpwId) !== String(nextPointRequired.cpId);
    const isCodeMismatch = String(listScanQr.cpwCode) !== String(nextPointRequired.cpCode);

    if (isIdMismatch || isCodeMismatch) {
      const userData = store.state.dataUser?.data || store.state.dataUser;

      // 1. TẠO PAYLOAD SCAN SAI (KÈM TỌA ĐỘ)
      const wrongScanPayload = {
        psId: Number(currentRoute.psId) || 0,
        routeId: Number(currentRoute.routeId) || 0,
        rdId: Number(nextPointRequired.rdId) || 0,
        wrongCpId: Number(listScanQr.cpwId) || 0,
        correctCpId: Number(nextPointRequired.cpId) || 0,
        createdAt: currentTimeString,
        createdBy: userData?.userId || ''
      };

      const handleWrongScanSync = async () => {
        const isOnline = store.state.isOnline;
        if (isOnline) {
          try {
            await ScanCpQrLog.createScanCpQrLog(wrongScanPayload);
          } catch (error) {
            await saveWrongScanOffline(wrongScanPayload);
          }
        } else {
          await saveWrongScanOffline(wrongScanPayload);
        }
      };

      const saveWrongScanOffline = async (payload: any) => {
        let wrongQueue = await storageService.get('offline_wrong_scan_queue');

        if (!Array.isArray(wrongQueue)) wrongQueue = [];
        wrongQueue.push(payload);
        await storageService.set('offline_wrong_scan_queue', wrongQueue);
      };

      handleWrongScanSync();

      return {
        code: 'WRONG_ORDER',
        nextPointName: nextPointRequired.cpName,
      };
    }

    // ==========================================
    // QUÉT ĐÚNG LOGIC TỪ ĐÂY XUỐNG
    // ==========================================
    try {
      let finalData = null;
      const isOnline = store.state.isOnline;

      if (isOnline) {
        try {
          const res = await CheckPointScanQr.getCheckPointScanQr(listScanQr);
          let actualData = res?.data?.data || res?.data;
          if (Array.isArray(actualData)) actualData = actualData[0];
          if (actualData) {
            finalData = actualData;
            await storageService.set(`checkpoint_${listScanQr.cpwId}`, actualData);
          }
        } catch (e) {
          console.warn("API lỗi, bắt đầu kiểm tra kho Offline");
        }
      }

      if (!finalData) {
        finalData = await storageService.get(`checkpoint_${listScanQr.cpwId}`);

        if (!finalData) {
          const response = await storageService.get('checkpoints');
          let allCheckpoints = [];
          if (response && response.data && Array.isArray(response.data)) {
            allCheckpoints = response.data;
          } else if (Array.isArray(response)) {
            allCheckpoints = response;
          }
          finalData = allCheckpoints.find((item: any) => String(item.cpId) === String(listScanQr.cpwId));
        }
      }

      if (finalData) {
        // Lưu psId + khóa ca trực trước khi chuyển trang báo cáo
        store.commit('SET_PSID', currentRoute.psId);
        store.commit('SET_UNFINISHED_ROUTE_ID', Number(currentRoute.routeId));

        store.commit('SET_DATASCANQR', finalData);
        await storageService.set('data_scanqr', finalData);
        await storageService.set('currentTime_scanqr', currentTimeString);

        router.replace({
          path: '/checkpoint/create',
          query: { routeId: routeId, psId: currentRoute.psId, t: Date.now() }
        });
      } else {
        presentAlertToast(t('messages.scanner.notification'), '', t('messages.scanner.checkpoint-not-found'));
      }
    } catch (error) {
      presentAlertToast(t('messages.scanner.notification'), '', t('messages.scanner.unable-to-process'));
    }
  }
};