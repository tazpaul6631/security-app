import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import { Store } from 'vuex';
import { Router } from 'vue-router';
import storageService from '@/services/storage.service';
import CheckPointScanQr from '@/api/CheckPointScanQr';
import presentAlert from '@/mixins/presentAlert';

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
            throw error; // Quăng lỗi để bên Vue component bắt được (như lỗi không có camera)
        }
    },

    // 2. Hàm mới: Xử lý chuỗi QR (Bất kể chuỗi đó lấy từ Camera hay từ nút bấm Unitech)
    async processQRString(store: Store<any>, router: Router, routeId: number, qrCodeString: string) {
        const now = new Date();
        const currentTimeString = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().slice(0, 19);
        const dataListRoute = store.state.dataListRoute;

        // Lưu routeId đang thực hiện vào store/storage
        store.commit('SET_ROUTE_ID', routeId);
        await storageService.set('current_route_id', routeId);

        // 1. Tìm lộ trình cụ thể mà người dùng đã chọn
        const currentRoute = dataListRoute.find((r: any) => r.routeId === routeId);
        if (!currentRoute) {
            await presentAlert.presentAlert('Lỗi', '', 'Không tìm thấy thông tin lộ trình đã chọn.');
            return;
        }

        const listScanQr = { cpwId: '', cpwCode: '' };

        // Parse URL từ chuỗi QR
        if (qrCodeString) {
            try {
                const url = new URL(qrCodeString);
                const segments = url.pathname.split('/');
                listScanQr.cpwId = segments[3];   // ID của checkpoint từ QR
                listScanQr.cpwCode = segments[4];
            } catch (e) {
                await presentAlert.presentAlert('Lỗi', '', 'Mã QR không hợp lệ');
                return;
            }
        } else {
            return; // Nếu chuỗi rỗng thì bỏ qua
        }

        // --- BẮT ĐẦU LOGIC KIỂM TRA LỘ TRÌNH ---
        const nextPointRequired = currentRoute.routeDetails.find((point: any) => point.status !== 1);

        if (!nextPointRequired) {
            await presentAlert.presentAlert('Thông báo', '', 'Lộ trình này đã được hoàn thành tất cả các điểm.');
            return;
        }

        if (String(listScanQr.cpwId) !== String(nextPointRequired.cpId)) {
            await presentAlert.presentAlert(
                'Sai thứ tự tuần tra',
                nextPointRequired.cpName,
                `Là điểm tiếp theo cần quét. Vui lòng đi đúng lộ trình.`,
                'custom-error-alert'
            );
            return;
        }
        // --- KẾT THÚC LOGIC KIỂM TRA LỘ TRÌNH ---

        try {
            let finalData = null;
            const isOnline = store.state.isOnline;

            // Xử lý lấy dữ liệu Online/Offline
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
                    console.warn("API lỗi, kiểm tra kho Offline");
                }
            }

            if (!finalData) {
                let response = await storageService.get('checkpoints');
                let allCheckpoints = Array.isArray(response) ? response : (response?.data || []);
                finalData = allCheckpoints.find((item: any) => String(item.cpId) === String(listScanQr.cpwId));
            }

            if (finalData) {
                console.log("Tìm thấy điểm tuần tra:", finalData);
                store.commit('SET_DATASCANQR', finalData);
                await storageService.set('data_scanqr', finalData);
                await storageService.set('currentTime_scanqr', currentTimeString);

                // Chuyển sang màn hình tạo báo cáo
                router.replace({
                    path: '/checkpoint/create',
                    query: { t: Date.now() }
                });
            } else {
                await presentAlert.presentAlert('Thông báo', '', 'Không tìm thấy thông tin điểm này trong dữ liệu hệ thống.');
            }
        } catch (error) {
            await presentAlert.presentAlert('Lỗi', '', 'Hệ thống không thể xử lý mã quét.');
        }
    }
};