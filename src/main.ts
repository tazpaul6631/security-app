import { createApp } from 'vue'
import App from '@/App.vue'
import router from '@/router';
import store from '@/composables/useVuex'
import i18n from '@/i18n';

import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'

import PrimeVue from 'primevue/config';
import ToastService from 'primevue/toastservice';
import Aura from '@primevue/themes/aura';
import 'primeicons/primeicons.css';

import './theme/variables.css';

const app = createApp(App)
  .use(PrimeVue, {
    ripple: false,
    theme: {
      preset: Aura,
      options: {
        darkModeSelector: false,
      },
    },
  })
  .use(ToastService)
  .use(router)
  .use(store)
  .use(i18n);

router.isReady().then(() => {
  app.mount('#app');
});
