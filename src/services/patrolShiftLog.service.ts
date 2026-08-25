import storage from '@/services/storage.service';
import Sync from '@/api/Sync';

export const PATROL_SHIFT_LOGS_KEY = 'patrol_shift_logs';

export interface PatrolLogRouteDetail {
  cpCode: string;
  cpName: string;
  rdIsComplete: boolean;
}

/** Payload gửi BE (không kèm metadata local) */
export interface PatrolShiftLogPayload {
  psId: number;
  psDay: number;
  psMonth: number;
  psYear: number;
  psHourFrom: number;
  routeName: string;
  areaName: string;
  isComplete: boolean;
  reportBy: string;
  reportName: string;
  routeDetails: PatrolLogRouteDetail[];
}

export type PatrolShiftLogStatus = 'draft' | 'ready' | 'failed' | 'invalid' | 'synced';

/** Bản ghi local — giữ metadata để Logs / sync an toàn */
export interface PatrolShiftLogRecord extends PatrolShiftLogPayload {
  localId: string;
  routeId?: number;
  /** userAreaName của người đi ca lúc ghi — dùng khi gửi, không lấy session hiện tại */
  userAreaName?: string;
  savedAt: string;
  source: 'online' | 'offline';
  pointCount: number;
  completedCount: number;
  syncAttempts: number;
  lastSyncAt?: string | null;
  lastSyncError?: string | null;
  status: PatrolShiftLogStatus;
}

export interface UpsertPointInput {
  psId: number;
  routeId: number;
  psDay: number;
  psMonth: number;
  psYear: number;
  psHourFrom: number;
  routeName: string;
  areaName: string;
  /** Snapshot userAreaName lúc người đi login — không lấy từ user đang mở app */
  userAreaName?: string;
  reportBy: string;
  reportName: string;
  source: 'online' | 'offline';
  /** Toàn bộ điểm lộ trình (để khởi tạo skeleton) */
  allPoints: Array<{ cpId: number | string; cpCode?: string; cpName: string; rdIsComplete?: boolean }>;
  /** Điểm vừa submit thành công */
  completedPoint: { cpId: number | string; cpCode: string; cpName: string };
}

const newLocalId = () =>
  `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

export async function loadPatrolShiftLogs(): Promise<PatrolShiftLogRecord[]> {
  const raw = (await storage.get(PATROL_SHIFT_LOGS_KEY)) || [];
  const list = Array.isArray(raw) ? raw : [];
  const deduped = dedupePatrolShiftLogs(list);
  if (deduped.length !== list.length) {
    await savePatrolShiftLogs(deduped);
  }
  return deduped;
}

export async function savePatrolShiftLogs(logs: PatrolShiftLogRecord[]): Promise<void> {
  await storage.set(PATROL_SHIFT_LOGS_KEY, logs);
}

/** Khóa ca để tránh trùng record / gọi API đôi */
function shiftKey(r: {
  psId: number | string;
  routeId?: number | string | null;
  psDay?: number | string | null;
  psMonth?: number | string | null;
  psYear?: number | string | null;
  psHourFrom?: number | string | null;
}): string {
  return [
    Number(r.psId),
    r.routeId != null && r.routeId !== '' ? Number(r.routeId) : '*',
    Number(r.psDay ?? 0),
    Number(r.psMonth ?? 0),
    Number(r.psYear ?? 0),
    Number(r.psHourFrom ?? 0),
  ].join('|');
}

function findLogIndex(
  logs: PatrolShiftLogRecord[],
  psId: number,
  routeId?: number,
  shiftMeta?: { psDay?: number; psMonth?: number; psYear?: number; psHourFrom?: number }
): number {
  const targetPsId = Number(psId);
  const targetRouteId = routeId != null ? Number(routeId) : null;

  // 1) Ưu tiên khớp psId + routeId
  if (targetRouteId != null && !Number.isNaN(targetRouteId)) {
    const byRoute = logs.findIndex(
      (l) =>
        Number(l.psId) === targetPsId &&
        l.routeId != null &&
        Number(l.routeId) === targetRouteId
    );
    if (byRoute >= 0) return byRoute;
  }

  // 2) Khớp psId + ngày/giờ ca (khi routeId lệch / thiếu)
  if (shiftMeta) {
    const byShift = logs.findIndex(
      (l) =>
        Number(l.psId) === targetPsId &&
        Number(l.psDay) === Number(shiftMeta.psDay) &&
        Number(l.psMonth) === Number(shiftMeta.psMonth) &&
        Number(l.psYear) === Number(shiftMeta.psYear) &&
        Number(l.psHourFrom) === Number(shiftMeta.psHourFrom)
    );
    if (byShift >= 0) return byShift;
  }

  // 3) Fallback: cùng psId (1 ca đang đi)
  return logs.findIndex((l) => Number(l.psId) === targetPsId);
}

/** Gộp record trùng cùng ca — giữ bản đầy đủ / sẵn sync hơn */
function dedupePatrolShiftLogs(logs: PatrolShiftLogRecord[]): PatrolShiftLogRecord[] {
  const map = new Map<string, PatrolShiftLogRecord>();
  const statusRank: Record<PatrolShiftLogStatus, number> = {
    synced: 5,
    ready: 4,
    failed: 3,
    invalid: 2,
    draft: 1,
  };

  for (const item of logs) {
    const key = shiftKey(item);
    const prev = map.get(key);
    if (!prev) {
      map.set(key, item);
      continue;
    }

    const preferItem =
      (item.completedCount || 0) > (prev.completedCount || 0) ||
      ((item.completedCount || 0) === (prev.completedCount || 0) &&
        (statusRank[item.status] || 0) >= (statusRank[prev.status] || 0));

    const winner = preferItem ? item : prev;
    const loser = preferItem ? prev : item;

    // Giữ routeId nếu winner thiếu
    if (winner.routeId == null && loser.routeId != null) {
      winner.routeId = loser.routeId;
    }
    map.set(key, winner);
  }

  return Array.from(map.values());
}

function recount(details: PatrolLogRouteDetail[]) {
  const pointCount = details.length;
  const completedCount = details.filter((d) => d.rdIsComplete).length;
  const isComplete = pointCount > 0 && completedCount === pointCount;
  return { pointCount, completedCount, isComplete };
}

function refreshStatus(record: PatrolShiftLogRecord): PatrolShiftLogRecord {
  const { pointCount, completedCount, isComplete } = recount(record.routeDetails);
  record.pointCount = pointCount;
  record.completedCount = completedCount;
  record.isComplete = isComplete;

  if (record.status === 'synced') {
    record.savedAt = new Date().toISOString();
    return record;
  }

  if (!isValidForSync(record)) {
    record.status = 'invalid';
  } else if (isComplete) {
    if (record.status !== 'failed') record.status = 'ready';
  } else {
    // Ca chưa đủ điểm — vẫn draft; finalize có thể đánh ready để sync kèm false
    if (record.status !== 'failed' && record.status !== 'ready') {
      record.status = 'draft';
    }
  }
  record.savedAt = new Date().toISOString();
  return record;
}

/** Validate trước khi gửi BE — cho phép rdIsComplete true/false theo thực tế */
export function isValidForSync(record: PatrolShiftLogRecord): boolean {
  if (!record) return false;
  if (!Array.isArray(record.routeDetails) || record.routeDetails.length === 0) return false;
  if (record.pointCount !== record.routeDetails.length) return false;
  if (!record.routeDetails.every((d) => !!d.cpCode && !!d.cpName)) return false;
  if (record.psId == null || Number.isNaN(Number(record.psId))) return false;
  if (!record.routeName || !record.areaName) return false;
  if (!record.reportBy || !record.reportName) return false;
  if (record.psDay == null || record.psMonth == null || record.psYear == null) return false;
  if (record.psHourFrom == null) return false;
  return true;
}

export function toApiPayload(record: PatrolShiftLogRecord): PatrolShiftLogPayload {
  return {
    psId: Number(record.psId),
    psDay: Number(record.psDay),
    psMonth: Number(record.psMonth),
    psYear: Number(record.psYear),
    psHourFrom: Number(record.psHourFrom),
    routeName: record.routeName,
    areaName: String(record.userAreaName || record.areaName || ''),
    isComplete: !!record.isComplete,
    reportBy: String(record.reportBy),
    reportName: record.reportName,
    routeDetails: record.routeDetails.map((d) => ({
      cpCode: d.cpCode,
      cpName: d.cpName,
      rdIsComplete: !!d.rdIsComplete,
    })),
  };
}

/**
 * Sau sendData thành công: đánh dấu 1 điểm trong snapshot ca.
 * Khi đủ điểm → status ready (chờ syncPatrolLog).
 */
export async function upsertPointInPatrolShiftLog(input: UpsertPointInput): Promise<PatrolShiftLogRecord> {
  let logs = dedupePatrolShiftLogs(await loadPatrolShiftLogs());
  let idx = findLogIndex(logs, input.psId, input.routeId, {
    psDay: input.psDay,
    psMonth: input.psMonth,
    psYear: input.psYear,
    psHourFrom: input.psHourFrom,
  });
  let record: PatrolShiftLogRecord;

  if (idx < 0) {
    const details: PatrolLogRouteDetail[] = input.allPoints.map((p) => {
      const isCurrent =
        String(p.cpId) === String(input.completedPoint.cpId) ||
        (p.cpCode && p.cpCode === input.completedPoint.cpCode);
      return {
        cpCode: isCurrent
          ? input.completedPoint.cpCode
          : String(p.cpCode || p.cpId || ''),
        cpName: isCurrent ? input.completedPoint.cpName : p.cpName,
        rdIsComplete: !!(isCurrent || p.rdIsComplete),
      };
    });

    // Đảm bảo điểm vừa xong có trong list
    if (!details.some((d) => d.cpCode === input.completedPoint.cpCode)) {
      details.push({
        cpCode: input.completedPoint.cpCode,
        cpName: input.completedPoint.cpName,
        rdIsComplete: true,
      });
    }

    record = {
      localId: newLocalId(),
      routeId: Number(input.routeId),
      psId: Number(input.psId),
      psDay: Number(input.psDay),
      psMonth: Number(input.psMonth),
      psYear: Number(input.psYear),
      psHourFrom: Number(input.psHourFrom),
      routeName: input.routeName,
      areaName: input.areaName,
      userAreaName: input.userAreaName || '',
      isComplete: false,
      reportBy: input.reportBy,
      reportName: input.reportName,
      routeDetails: details,
      savedAt: new Date().toISOString(),
      source: input.source,
      pointCount: details.length,
      completedCount: 0,
      syncAttempts: 0,
      lastSyncAt: null,
      lastSyncError: null,
      status: 'draft',
    };
    logs.push(record);
    idx = logs.length - 1;
  } else {
    record = { ...logs[idx] };
    if (record.routeId == null && input.routeId != null) {
      record.routeId = Number(input.routeId);
    }
    const details = [...(record.routeDetails || [])];
    const dIdx = details.findIndex(
      (d) =>
        d.cpCode === input.completedPoint.cpCode ||
        d.cpName === input.completedPoint.cpName
    );
    if (dIdx >= 0) {
      details[dIdx] = {
        cpCode: input.completedPoint.cpCode || details[dIdx].cpCode,
        cpName: input.completedPoint.cpName || details[dIdx].cpName,
        rdIsComplete: true,
      };
    } else {
      details.push({
        cpCode: input.completedPoint.cpCode,
        cpName: input.completedPoint.cpName,
        rdIsComplete: true,
      });
    }
    record.routeDetails = details;
    record.source = input.source;
    // Giữ người đi ca ban đầu (kể cả khi user khác login rồi sync)
    if (!record.reportBy) record.reportBy = input.reportBy;
    if (!record.reportName) record.reportName = input.reportName;
    if (!record.userAreaName) record.userAreaName = input.userAreaName;
  }

  record = refreshStatus(record);
  logs[idx] = record;
  logs = dedupePatrolShiftLogs(logs);
  await savePatrolShiftLogs(logs);
  return record;
}

/** Snapshot ca khi allDone — update record có sẵn, không tạo trùng */
export async function finalizePatrolShiftLog(input: UpsertPointInput): Promise<PatrolShiftLogRecord | null> {
  let logs = dedupePatrolShiftLogs(await loadPatrolShiftLogs());
  let idx = findLogIndex(logs, input.psId, input.routeId, {
    psDay: input.psDay,
    psMonth: input.psMonth,
    psYear: input.psYear,
    psHourFrom: input.psHourFrom,
  });

  const details: PatrolLogRouteDetail[] = input.allPoints.map((p) => ({
    cpCode: String(p.cpCode || p.cpId || ''),
    cpName: p.cpName,
    rdIsComplete: !!p.rdIsComplete,
  }));

  if (idx < 0) {
    // Không có bản upsert trước đó — tạo 1 lần duy nhất
    let record = refreshStatus({
      localId: newLocalId(),
      routeId: Number(input.routeId),
      psId: Number(input.psId),
      psDay: Number(input.psDay),
      psMonth: Number(input.psMonth),
      psYear: Number(input.psYear),
      psHourFrom: Number(input.psHourFrom),
      routeName: input.routeName,
      areaName: input.areaName,
      userAreaName: input.userAreaName || '',
      isComplete: false,
      reportBy: input.reportBy,
      reportName: input.reportName,
      routeDetails: details,
      savedAt: new Date().toISOString(),
      source: input.source,
      pointCount: details.length,
      completedCount: 0,
      syncAttempts: 0,
      lastSyncAt: null,
      lastSyncError: null,
      status: 'draft',
    });
    if (isValidForSync(record) && record.status !== 'failed' && record.status !== 'synced') {
      record.status = 'ready';
    }
    logs.push(record);
    logs = dedupePatrolShiftLogs(logs);
    await savePatrolShiftLogs(logs);
    return record;
  }

  const existing = logs[idx];
  const merged = details.map((d) => {
    const prev = existing.routeDetails.find(
      (x) => x.cpCode === d.cpCode || x.cpName === d.cpName
    );
    return {
      cpCode: prev?.cpCode && String(prev.cpCode) !== String(d.cpCode) ? prev.cpCode : d.cpCode,
      cpName: d.cpName || prev?.cpName || '',
      rdIsComplete: !!d.rdIsComplete,
    };
  });

  let record = refreshStatus({
    ...existing,
    routeId: existing.routeId ?? Number(input.routeId),
    routeDetails: merged,
    routeName: input.routeName || existing.routeName,
    areaName: input.areaName || existing.areaName,
    userAreaName: existing.userAreaName || input.userAreaName,
    source: input.source,
    psDay: Number(input.psDay ?? existing.psDay),
    psMonth: Number(input.psMonth ?? existing.psMonth),
    psYear: Number(input.psYear ?? existing.psYear),
    psHourFrom: Number(input.psHourFrom ?? existing.psHourFrom),
  });
  if (isValidForSync(record) && record.status !== 'failed' && record.status !== 'synced') {
    record.status = 'ready';
  }
  logs[idx] = record;
  logs = dedupePatrolShiftLogs(logs);
  await savePatrolShiftLogs(logs);
  return record;
}

function evaluateSyncResponse(payload: any): 'success' | 'failed' {
  if (!payload || typeof payload !== 'object') return 'failed';
  if (payload.success === true) return 'success';
  // Một số BE bọc data
  if (payload.data && typeof payload.data === 'object' && payload.data.success === true) {
    return 'success';
  }
  const msg = String(payload.message || '').toLowerCase();
  if (msg.includes('đã tồn tại') || msg.includes('already exist') || msg.includes('duplicate')) {
    return 'success';
  }
  return 'failed';
}

/**
 * Gửi từng ca ready/failed lên syncPatrolLog.
 * success → giữ local với status synced; fail → giữ + cập nhật metadata. Không throw ra UI.
 */
let isSyncingPatrolLogs = false;

export async function syncPatrolShiftLogs(): Promise<{
  sent: number;
  removed: number;
  failed: number;
  remaining: number;
}> {
  if (isSyncingPatrolLogs) {
    return { sent: 0, removed: 0, failed: 0, remaining: (await loadPatrolShiftLogs()).length };
  }
  isSyncingPatrolLogs = true;

  try {
    let logs = dedupePatrolShiftLogs(await loadPatrolShiftLogs());
    // Persist dedupe ngay để Logs/UI không còn bản trùng
    await savePatrolShiftLogs(logs);

    let removed = 0;
    let failed = 0;
    let sent = 0;
    const kept: PatrolShiftLogRecord[] = [];
    const sentKeys = new Set<string>();

    for (const item of logs) {
      const key = shiftKey(item);

      // Ca đang đi / đã gửi — không gọi API
      if (item.status === 'draft' || item.status === 'synced') {
        kept.push(item);
        continue;
      }

      if (!isValidForSync(item)) {
        kept.push({
          ...item,
          status: 'invalid',
          lastSyncError: item.lastSyncError || 'INVALID_LOCAL',
          lastSyncAt: new Date().toISOString(),
        });
        failed++;
        continue;
      }

      // Tránh gửi 2 lần cùng một ca trong 1 vòng sync
      if (sentKeys.has(key)) {
        kept.push(item);
        continue;
      }
      sentKeys.add(key);

      sent++;
      try {
        const result = await Sync.syncPatrolLog([toApiPayload(item)]);
        const envelope = result?.data ?? result;
        const evalStatus = evaluateSyncResponse(envelope);

        if (evalStatus === 'success') {
          kept.push({
            ...item,
            status: 'synced',
            lastSyncAt: new Date().toISOString(),
            lastSyncError: null,
          });
          removed++;
          continue;
        }

        kept.push({
          ...item,
          status: 'failed',
          syncAttempts: (item.syncAttempts || 0) + 1,
          lastSyncAt: new Date().toISOString(),
          lastSyncError: envelope?.message || 'POINT_REPORT_NOT_SUCCESS',
        });
        failed++;
      } catch (err: any) {
        kept.push({
          ...item,
          status: 'failed',
          syncAttempts: (item.syncAttempts || 0) + 1,
          lastSyncAt: new Date().toISOString(),
          lastSyncError: err?.message || err?.code || 'NETWORK_ERROR',
        });
        failed++;
      }
    }

    await savePatrolShiftLogs(dedupePatrolShiftLogs(kept));
    return { sent, removed, failed, remaining: kept.length };
  } finally {
    isSyncingPatrolLogs = false;
  }
}
