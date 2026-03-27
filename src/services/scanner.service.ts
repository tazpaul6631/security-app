import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import { Store } from 'vuex';
import { Router } from 'vue-router';
import storageService from '@/services/storage.service';
import CheckPointScanQr from '@/api/CheckPointScanQr';
import presentAlert from '@/mixins/presentAlert';
import ScanCpQrLog from '@/api/ScanCpQrLog';

export const scannerService = {
    async requestPermissions() {
        const { camera } = await BarcodeScanner.requestPermissions();
        return camera === 'granted' || camera === 'limited';
    },

    // 1. Hàm này giờ CHỈ DÙNG ĐỂ MỞ CAMERA trên điện thoại và TRẢ VỀ CHUỖI QR
    async startScanning(store: Store<any>, router: Router, routeId: number): Promise<string | null> {
        const granted = await this.requestPermissions();
        if (!granted) {
            await presentAlert.presentAlert('Lỗi', '', 'Vui lòng cấp quyền sử dụng máy ảnh để quét mã.');
            return null;
        }

        try {
            const { barcodes } = await BarcodeScanner.scan();
            if (!barcodes || barcodes.length === 0) return null;

            // Trả về chuỗi rawValue của mã QR vừa quét bằng Camera
            return barcodes[0].rawValue || null;
        } catch (error) {
            console.error("Camera scan error:", error);
            throw error;
        }
    },

    // 2. Hàm mới: Xử lý chuỗi QR (Bất kể chuỗi đó lấy từ Camera hay từ nút bấm Unitech)
    async processQRString(store: Store<any>, router: Router, routeId: number, qrCodeString: string) {
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
            currentRoute = dataListRoute.find((r: any) => Number(r.routeId) === Number(routeId));
        }

        if (!currentRoute) {
            await presentAlert.presentAlert('Lỗi', '', 'Không tìm thấy thông tin lộ trình đã chọn.');
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
                await presentAlert.presentAlert('Lỗi', '', 'Mã QR không hợp lệ');
                return;
            }
        } else {
            return;
        }

        const nextPointRequired = currentRoute.routeDetails.find((point: any) => point.status !== 1);

        if (!nextPointRequired) {
            await presentAlert.presentAlert('Thông báo', '', 'Lộ trình này đã được hoàn thành tất cả các điểm.');
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
                console.log(wrongQueue);

                if (!Array.isArray(wrongQueue)) wrongQueue = [];
                wrongQueue.push(payload);
                console.log(wrongQueue);
                await storageService.set('offline_wrong_scan_queue', wrongQueue);
            };

            handleWrongScanSync();

            await presentAlert.presentAlert(
                'Sai thứ tự tuần tra',
                nextPointRequired.cpName,
                `Là điểm tiếp theo cần quét. Vui lòng đi đúng lộ trình.`,
                'custom-error-alert'
            );
            return;
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
                // KHI QUÉT ĐÚNG: LƯU TỌA ĐỘ VÀO VUEX & SQLITE
                store.commit('SET_DATASCANQR', finalData);
                await storageService.set('data_scanqr', finalData);
                await storageService.set('currentTime_scanqr', currentTimeString);

                router.replace({
                    path: '/checkpoint/create',
                    query: { routeId: routeId, t: Date.now() }
                });
            } else {
                await presentAlert.presentAlert('Thông báo', '', 'Không tìm thấy thông tin điểm này trong dữ liệu hệ thống.');
            }
        } catch (error) {
            await presentAlert.presentAlert('Lỗi', '', 'Hệ thống không thể xử lý mã quét.');
        }
    }
};