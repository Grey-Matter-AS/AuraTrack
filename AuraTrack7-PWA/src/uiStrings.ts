import { message, type Language } from '@auratrack/i18n';
import type { UiStrings } from '@auratrack/ui';

/** The few words the kit shows itself (Close, Back, "2 of 4", ...), in the chosen language. */
export const uiStringsFor = (language: Language): UiStrings => ({
  close: message(language, 'ui.close'),
  back: message(language, 'ui.back'),
  choose: message(language, 'ui.choose'),
  selectDate: message(language, 'ui.selectDate'),
  selectTime: message(language, 'ui.selectTime'),
  selectDateTime: message(language, 'ui.selectDateTime'),
  selectMonth: message(language, 'ui.selectMonth'),
  position: (n, total) => message(language, 'ui.position', { n, total }),
  chooseTab: message(language, 'ui.chooseTab'),
  switchPatient: message(language, 'ui.switchPatient'),
});
