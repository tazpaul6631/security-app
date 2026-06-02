/**
 * Nguồn sự thật tập trung cho session tuần tra đang active (routeId + psId).
 * Dùng trong getters Vuex, router guard và validate màn báo cáo.
 */

export function getPatrolRouteId(state: { unfinishedRouteId?: any; routeId?: any }): number | null {
  const id = state.unfinishedRouteId ?? state.routeId;
  return id != null && id !== '' ? Number(id) : null;
}

export function getPatrolPsId(state: { psId?: any }): number | null {
  return state.psId != null && state.psId !== '' ? Number(state.psId) : null;
}

export function findActiveRoute(state: {
  dataListRoute?: any[];
  unfinishedRouteId?: any;
  routeId?: any;
  psId?: any;
}): any | null {
  const routeId = getPatrolRouteId(state);
  const psId = getPatrolPsId(state);
  if (!routeId || !psId) return null;

  return (state.dataListRoute || []).find((r: any) =>
    Number(r.routeId) === routeId && Number(r.psId) === psId
  ) ?? null;
}

/** Có đủ dữ liệu quét + ca trực khớp trong list_route */
export function isPatrolSessionValid(state: {
  dataScanQr?: any;
  dataListRoute?: any[];
  unfinishedRouteId?: any;
  routeId?: any;
  psId?: any;
}): boolean {
  if (!state.dataScanQr) return false;
  return !!findActiveRoute(state);
}

/** Ca dở dang thực sự (có khóa, khớp list, còn điểm chưa quét) */
export function isRouteUnfinished(state: {
  unfinishedRouteId?: any;
  psId?: any;
  dataListRoute?: any[];
  routeId?: any;
}): boolean {
  if (!state.unfinishedRouteId || !state.psId) return false;

  const route = findActiveRoute(state);
  if (!route?.routeDetails?.length) return false;

  return route.routeDetails.some((p: any) => !p.rdIsComplete);
}
