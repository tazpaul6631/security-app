import { createI18n } from 'vue-i18n';
import vi from './locales/vi.json';
import en from './locales/en.json';
import zh from './locales/zh.json';

const i18n = createI18n({
  legacy: false,
  locale: 'vi',
  fallbackLocale: 'en',
  globalInjection: true,
  messages: {
    vi: vi,
    en: en,
    zh: zh
  } as any
});

export default i18n;