import ToastEventBus from 'primevue/toasteventbus';

type ToastSeverity = 'success' | 'info' | 'warn' | 'error';

/**
 * Toast PrimeVue dùng được cả trong Vue SFC và service thuần (qua ToastEventBus).
 */
export function presentToast(
  detail: string,
  options?: {
    summary?: string;
    severity?: ToastSeverity;
    life?: number;
  }
) {
  ToastEventBus.emit('add', {
    severity: options?.severity ?? 'warn',
    summary: options?.summary || undefined,
    detail,
    life: options?.life ?? 8000,
    closable: false,
  });
}

/** Thay presentAlert(header, subHeader, message) → toast */
export function presentAlertToast(
  header: string,
  _subHeader: string,
  message: string,
  severity: ToastSeverity = 'warn'
) {
  presentToast(message, { summary: header, severity });
}
