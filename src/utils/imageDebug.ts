/** Chỉ dùng khi dev — giả lập lỗi ảnh để test UX mà không cần máy yếu */

export const IMAGE_DEBUG_KEY = 'security_app_image_debug';

export const IMAGE_DEBUG_MODES = [
  'watermark_fail',
  'checkin_submit_fail',
  'checkin_invalid_mime',
  'report_submit_fail',
  'save_file_mismatch',
] as const;

type ImageDebugModeValue = (typeof IMAGE_DEBUG_MODES)[number];
export type ImageDebugMode = ImageDebugModeValue | '';

const isDebugModeValue = (value: string): value is ImageDebugModeValue =>
  (IMAGE_DEBUG_MODES as readonly string[]).includes(value);

const INVALID_FETCH_URL = 'capacitor://localhost/_debug_invalid_image';

export function isImageDebugEnabled(): boolean {
  return import.meta.env.DEV;
}

export function getImageDebugMode(): ImageDebugMode {
  if (!isImageDebugEnabled()) return '';
  const mode = localStorage.getItem(IMAGE_DEBUG_KEY) || '';
  return isDebugModeValue(mode) ? mode : '';
}

export function setImageDebugMode(mode: ImageDebugMode): void {
  if (!isImageDebugEnabled()) return;
  if (mode) {
    localStorage.setItem(IMAGE_DEBUG_KEY, mode);
    console.info(`[imageDebug] mode = ${mode}`);
  } else {
    localStorage.removeItem(IMAGE_DEBUG_KEY);
    console.info('[imageDebug] cleared');
  }
}

export function shouldSimulateWatermarkFail(): boolean {
  return getImageDebugMode() === 'watermark_fail';
}

/** Ghi đè preview trước khi fetch lúc submit */
export function getDebugSubmitPreview(
  preview: string,
  context: 'checkin' | 'report'
): string {
  const mode = getImageDebugMode();
  if (!mode) return preview;

  if (mode === 'checkin_submit_fail' && context === 'checkin') {
    return INVALID_FETCH_URL;
  }
  if (mode === 'checkin_invalid_mime' && context === 'checkin') {
    return 'data:image/bmp;base64,invalid';
  }
  if (mode === 'report_submit_fail' && context === 'report') {
    return INVALID_FETCH_URL;
  }
  return preview;
}

/** Bỏ 1 base64 cuối để test lỗi lưu file / mismatch trong sendData */
export function applySaveFileMismatchDebug(base64List: string[]): string[] {
  if (getImageDebugMode() !== 'save_file_mismatch' || base64List.length === 0) {
    return base64List;
  }
  console.warn('[imageDebug] save_file_mismatch — bỏ ảnh cuối trước khi lưu file');
  return base64List.slice(0, -1);
}

export function installImageDebugConsole(): void {
  if (!isImageDebugEnabled()) return;

  const api = {
    mode: () => getImageDebugMode(),
    set: (mode: ImageDebugMode) => setImageDebugMode(mode),
    clear: () => setImageDebugMode(''),
    modes: IMAGE_DEBUG_MODES,
    help: () => {
      console.info(`
[imageDebug] Cách test lỗi ảnh (chỉ DEV):

1. watermark_fail
   → Chụp check-in → toast msg 12, không lưu ảnh

2. checkin_submit_fail
   → Chụp OK → Gửi báo cáo → toast msg 13, reset ảnh check-in

3. checkin_invalid_mime
   → Chụp OK → Gửi → toast msg 13 (MIME không hỗ trợ)

4. report_submit_fail
   → Chụp check-in + thêm ảnh no-problem/hasProblem → Gửi → toast msg 14

5. save_file_mismatch
   → Gửi online → sendData throw mismatch (ảnh không khớp metadata)

Ví dụ:
  __imageDebug.set('checkin_submit_fail')
  __imageDebug.clear()
`);
    },
  };

  (window as any).__imageDebug = api;
  console.info('[imageDebug] Gõ __imageDebug.help() để xem hướng dẫn');
}
