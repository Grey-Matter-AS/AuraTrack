let _enabled = true;

export const setHapticEnabled = (val) => { _enabled = val; };

export const haptic = (ms) => {
  if (_enabled && 'vibrate' in navigator) navigator.vibrate(ms);
};
