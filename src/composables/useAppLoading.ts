import { computed, ref } from 'vue';

const loadingCount = ref(0);
const loadingMessage = ref('');

export const isAppLoading = computed(() => loadingCount.value > 0);

export function useAppLoading() {
  const show = (message = '') => {
    loadingMessage.value = message;
    loadingCount.value += 1;
  };

  const hide = () => {
    if (loadingCount.value > 0) {
      loadingCount.value -= 1;
    }
    if (loadingCount.value === 0) {
      loadingMessage.value = '';
    }
  };

  return {
    isAppLoading,
    loadingMessage,
    show,
    hide,
  };
}
