import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import nb from './locales/nb.json';
import de from './locales/de.json';
import fr from './locales/fr.json';
import es from './locales/es.json';
import sv from './locales/sv.json';
import fi from './locales/fi.json';
import nn from './locales/nn.json';
import da from './locales/da.json';

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    nb: { translation: nb },
    de: { translation: de },
    fr: { translation: fr },
    es: { translation: es },
    sv: { translation: sv },
    fi: { translation: fi },
    nn: { translation: nn },
    da: { translation: da },
  },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;
