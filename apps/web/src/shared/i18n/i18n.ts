import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import enAuth from './locales/en/auth.json';
import enCalendar from './locales/en/calendar.json';
import enCommon from './locales/en/common.json';
import enFamily from './locales/en/family.json';
import enHome from './locales/en/home.json';
import enMeals from './locales/en/meals.json';
import enShopping from './locales/en/shopping.json';
import svAuth from './locales/sv/auth.json';
import svCalendar from './locales/sv/calendar.json';
import svCommon from './locales/sv/common.json';
import svFamily from './locales/sv/family.json';
import svHome from './locales/sv/home.json';
import svMeals from './locales/sv/meals.json';
import svShopping from './locales/sv/shopping.json';

const resources = {
  en: {
    common: enCommon,
    auth: enAuth,
    home: enHome,
    calendar: enCalendar,
    meals: enMeals,
    shopping: enShopping,
    family: enFamily,
  },
  sv: {
    common: svCommon,
    auth: svAuth,
    home: svHome,
    calendar: svCalendar,
    meals: svMeals,
    shopping: svShopping,
    family: svFamily,
  },
} as const;

void i18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  supportedLngs: ['en', 'sv'],
  defaultNS: 'common',
  ns: ['common', 'auth', 'home', 'calendar', 'meals', 'shopping', 'family'],
  resources,
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
