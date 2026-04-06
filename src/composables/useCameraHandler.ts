import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { toastController } from '@ionic/vue';
import { useI18n } from 'vue-i18n';

// Interface trả về cho các file gọi Composable này sử dụng
interface Photo {
    fileName: string;
    preview: string;
    rawBase64?: string; // Giữ lại dự phòng nếu sau này cần
}

export function useCameraHandler() {
    const { t } = useI18n();

    // Hàm tiện ích: Hiển thị thông báo (Giống hàm showToast ở file cha)
    const showToast = async (message: string, color: string = 'warning') => {
        const toast = await toastController.create({
            message,
            color,
            duration: 1000,
            position: 'top'
        });
        await toast.present();
    };

    // 1. HÀM CHỤP ẢNH TỪ CAMERA
    // currentCount: Số ảnh hiện có (để check giới hạn 10 tấm)
    // prefix: Tiền tố tên file (ví dụ 'ok_cam_' hoặc 'err_cam_')
    const takePhoto = async (currentCount: number, prefix: string = 'img_'): Promise<Photo | null> => {
        if (currentCount >= 10) {
            await showToast(t('messages.use-camera.max-images'));
            return null; // Trả về null nếu vi phạm luật
        }

        try {
            const image = await Camera.getPhoto({
                quality: 60,
                width: 1024,
                resultType: CameraResultType.Uri,
                source: CameraSource.Camera
            });

            if (image.webPath) {
                return {
                    fileName: `${prefix}${Date.now()}.jpg`,
                    preview: image.webPath
                };
            }
            return null;
        } catch (e) {
            console.log("Hủy chụp ảnh hoặc lỗi camera:", e);
            return null;
        }
    };

    // 2. HÀM CHỌN ẢNH TỪ THƯ VIỆN
    // currentCount: Số ảnh hiện có (để tính slotsLeft)
    // prefix: Tiền tố tên file
    const pickImagesFromGallery = async (currentCount: number, prefix: string = 'img_'): Promise<Photo[]> => {
        const slotsLeft = 10 - currentCount;

        if (slotsLeft <= 0) {
            await showToast(t('messages.use-camera.limit-reached'));
            return []; // Trả về mảng rỗng nếu vi phạm
        }

        try {
            const result = await Camera.pickImages({
                quality: 60,
                limit: slotsLeft
            });

            let photosToAdd = result.photos;

            // Cắt mảng dự phòng
            if (photosToAdd.length > slotsLeft) {
                await showToast(t('messages.use-camera.taking-images', { count: slotsLeft }));
                photosToAdd = photosToAdd.slice(0, slotsLeft);
            }

            // Convert kết quả của Capacitor thành Interface Photo của chúng ta
            return photosToAdd.map(photo => {
                // photo.format thường trả về 'jpeg', 'png', 'webp', v.v.
                // Fallback về 'jpg' nếu không lấy được format
                let ext = photo.format ? `.${photo.format.toLowerCase()}` : '.jpg';
                // Chuẩn hóa jpeg thành jpg để đồng nhất với mảng AllowImageExtetions của backend
                if (ext === '.jpeg') ext = '.jpg';

                return {
                    fileName: `${prefix}${Date.now()}_${Math.floor(Math.random() * 1000)}${ext}`,
                    preview: photo.webPath
                };
            });

        } catch (e) {
            console.log("Hủy chọn ảnh thư viện:", e);
            return [];
        }
    };

    // 3. Hàm phụ trợ convert Blob (Dùng lúc Submit)
    const convertBlobToBase64 = (blob: Blob): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = reject;
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
        });
    };

    return {
        takePhoto,
        pickImagesFromGallery,
        convertBlobToBase64,
        showToast
    };
}