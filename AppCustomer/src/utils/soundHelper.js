/**
 * Safe sound helper that gracefully handles missing native audio modules (e.g. Expo Go)
 */
let Audio = null;
try {
  const ExpoAv = require('expo-av');
  Audio = ExpoAv.Audio;
} catch (e) {
  // ExponentAV is not available in modern Expo Go clients
  // Suppress uncaught exception to avoid crashing the app runtime
}

export const loadSoundAsync = async (source) => {
  try {
    if (!Audio || !Audio.Sound) return null;
    const { sound } = await Audio.Sound.createAsync(source);
    return sound;
  } catch (err) {
    return null;
  }
};

export const playSoundAsync = async (soundObj) => {
  try {
    if (soundObj && typeof soundObj.replayAsync === 'function') {
      await soundObj.replayAsync();
    }
  } catch (_) {}
};

export const unloadSoundAsync = async (soundObj) => {
  try {
    if (soundObj && typeof soundObj.unloadAsync === 'function') {
      await soundObj.unloadAsync();
    }
  } catch (_) {}
};
