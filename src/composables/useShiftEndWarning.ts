import store from '@/composables/useVuex';
import { findActiveRoute } from '@/composables/usePatrolSession';
import { speakImportantText } from '@/services/ttsService';

const WARN_WINDOW_MINUTES = 10;
const POLL_MS = 15000;

/** Đã speak cho psId nào trong phiên (tránh lặp) */
const spokenForPsIds = new Set<string>();

let intervalId: ReturnType<typeof setInterval> | null = null;

/**
 * Thời điểm kết thúc khung giờ ca (xử lý ca cùng giờ / qua đêm).
 * - Ca slot 1 giờ (11→11): hết lúc (to+1):00 → cảnh báo 11:50
 * - Ca khoảng (8→16): hết lúc to:00
 * - Ca qua đêm (22→06): hết lúc to:00 (sáng hôm sau nếu đang ở phía from)
 */
export function getShiftHourEnd(route: { psHourFrom?: any; psHourTo?: any }, now = new Date()): Date | null {
  const from = Number(route.psHourFrom);
  const to = Number(route.psHourTo);
  if (!Number.isFinite(to) || to < 0 || to > 23) return null;

  const end = new Date(now);
  end.setSeconds(0, 0);
  end.setMilliseconds(0);

  // Ca cùng giờ (vd ca 11: from=to=11) → hết khung giờ là (to+1):00
  if (Number.isFinite(from) && from === to) {
    if (to === 23) {
      end.setDate(end.getDate() + 1);
      end.setHours(0, 0, 0, 0);
    } else {
      end.setHours(to + 1, 0, 0, 0);
    }
    return end;
  }

  end.setHours(to, 0, 0, 0);

  // Ca qua đêm (vd 22→06): buổi tối đang đi → hết ca là sáng hôm sau
  if (Number.isFinite(from) && from > to && now.getHours() >= from) {
    end.setDate(end.getDate() + 1);
  }

  return end;
}

export function minutesUntilShiftHourEnd(route: { psHourFrom?: any; psHourTo?: any }, now = new Date()): number | null {
  const end = getShiftHourEnd(route, now);
  if (!end) return null;
  return (end.getTime() - now.getTime()) / 60000;
}

const tickShiftEndWarning = () => {
  if (!store.getters.isRouteUnfinished) return;

  const route = findActiveRoute(store.state);
  if (!route || route.isComplete) return;

  const psId = String(route.psId);
  if (spokenForPsIds.has(psId)) return;

  const end = getShiftHourEnd(route);
  if (!end) return;

  const minutesLeft = (end.getTime() - Date.now()) / 60000;

  // Trong cửa sổ 10 phút cuối trước giờ hết ca
  if (minutesLeft <= 0 || minutesLeft > WARN_WINDOW_MINUTES) return;

  const deadlineHour = end.getHours();
  spokenForPsIds.add(psId);
  void speakImportantText(
    `Vui lòng hoàn thành ca trực trước ${deadlineHour} giờ`
  );
};

/** Clear cờ speak khi đổi / hết ca (gọi khi clear unfinished nếu cần) */
export function resetShiftEndWarningForPsId(psId: string | number | null | undefined) {
  if (psId == null || psId === '') return;
  spokenForPsIds.delete(String(psId));
}

export function startShiftEndWarningWatcher() {
  if (intervalId != null) return;

  tickShiftEndWarning();
  intervalId = setInterval(tickShiftEndWarning, POLL_MS);
}

export function stopShiftEndWarningWatcher() {
  if (intervalId != null) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
