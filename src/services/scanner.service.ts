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

        // ==========================================
        // 1. CHỐT KHÓA 1: TÌM LỘ TRÌNH PHẢI CÓ PSID ĐỂ KHÔNG NHẢY CA
        // ==========================================
        const targetPsId = store.state.psId;
        let currentRoute;

        // Ưu tiên 1: Tìm bằng CẢ routeId VÀ psId
        if (targetPsId) {
            currentRoute = dataListRoute.find((r: any) =>
                Number(r.routeId) === Number(routeId) &&
                Number(r.psId) === Number(targetPsId)
            );
        }

        // Ưu tiên 2: Fallback tìm mỗi routeId (Dành cho ca mới tinh chưa lưu khóa psId)
        if (!currentRoute) {
            currentRoute = dataListRoute.find((r: any) => Number(r.routeId) === Number(routeId));
        }

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
            return;
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

            // Xử lý lấy dữ liệu Online
            if (isOnline) {
                try {
                    const res = await CheckPointScanQr.getCheckPointScanQr(listScanQr);
                    let actualData = res?.data?.data || res?.data;
                    if (Array.isArray(actualData)) actualData = actualData[0];
                    if (actualData) {
                        finalData = actualData;
                        // Lưu bản nháp CHẤT LƯỢNG CAO xuống máy
                        await storageService.set(`checkpoint_${listScanQr.cpwId}`, actualData);
                    }
                } catch (e) {
                    console.warn("API lỗi, bắt đầu kiểm tra kho Offline");
                }
            }

            // ==========================================
            // 2. CHỐT KHÓA 2: XỬ LÝ LẤY DATA OFFLINE THÔNG MINH
            // ==========================================
            if (!finalData) {
                // Ưu tiên 1: Lấy từ bản nháp CHẤT LƯỢNG CAO (có đầy đủ areaName, cpCode, cpQr) mà lúc online đã lưu
                finalData = await storageService.get(`checkpoint_${listScanQr.cpwId}`);

                // Ưu tiên 2: Nếu máy hoàn toàn chưa từng có mạng để lưu nháp, mới tìm trong kho tổng (Chấp nhận thiếu 1 vài trường text)
                if (!finalData) {
                    let response = await storageService.get('checkpoints');
                    let allCheckpoints = [];
                    // Bóc tách JSON an toàn hơn cho Offline
                    if (Array.isArray(response)) {
                        allCheckpoints = response;
                    } else if (response?.data) {
                        allCheckpoints = Array.isArray(response.data) ? response.data : (response.data.data || []);
                    }

                    finalData = allCheckpoints.find((item: any) => String(item.cpId) === String(listScanQr.cpwId));
                }
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