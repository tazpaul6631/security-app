import { nextTick, onMounted, onUnmounted, ref, watch, type Ref } from 'vue';

export function useInfiniteScroll(
  disabled: Ref<boolean>,
  onLoadMore: () => void | Promise<void>,
  rootRef?: Ref<HTMLElement | null>,
) {
  const sentinelRef = ref<HTMLElement | null>(null);
  const isLoadingMore = ref(false);
  let observer: IntersectionObserver | null = null;
  let loading = false;

  const isSentinelVisible = () => {
    const sentinel = sentinelRef.value;
    if (!sentinel) return false;

    const margin = 120;
    const s = sentinel.getBoundingClientRect();
    const root = rootRef?.value ?? null;
    const r = root
      ? root.getBoundingClientRect()
      : { top: 0, left: 0, bottom: window.innerHeight, right: window.innerWidth };

    return (
      s.bottom >= r.top - margin &&
      s.top <= r.bottom + margin &&
      s.right >= r.left &&
      s.left <= r.right
    );
  };

  const fillIfVisible = async () => {
    if (loading || disabled.value) return;
    loading = true;
    isLoadingMore.value = true;
    try {
      let guard = 0;
      while (!disabled.value && sentinelRef.value && isSentinelVisible() && guard < 40) {
        guard += 1;
        await onLoadMore();
        await nextTick();
      }
    } finally {
      loading = false;
      isLoadingMore.value = false;
    }
  };

  const connect = () => {
    observer?.disconnect();
    if (!sentinelRef.value) return;

    observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) void fillIfVisible();
    }, {
      root: rootRef?.value ?? null,
      rootMargin: '120px',
      threshold: 0,
    });

    observer.observe(sentinelRef.value);
    void fillIfVisible();
  };

  onMounted(connect);
  watch(sentinelRef, connect);
  watch(() => rootRef?.value, connect);
  watch(disabled, (isDisabled) => {
    if (!isDisabled) void fillIfVisible();
  });
  onUnmounted(() => observer?.disconnect());

  return { sentinelRef, isLoadingMore };
}
