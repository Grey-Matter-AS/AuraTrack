export const haptic = (ms) => {
  if ('vibrate' in navigator) navigator.vibrate(ms);
};
