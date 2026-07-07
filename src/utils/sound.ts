/**
 * src/utils/sound.ts
 *
 * WHY THE DYNAMIC IMPORT TRICK IS NOT ENOUGH:
 * expo-av uses a native module called 'ExponentAV'. When the dev client was
 * built WITHOUT expo-av included (e.g. an old build), React Native's module
 * registry throws "Cannot find native module 'ExponentAV'" at the moment the
 * JS module is first evaluated — BEFORE our try/catch can intercept it.
 *
 * The fix: wrap the dynamic import() itself in its own try/catch. If the
 * import throws, we log a one-time dev warning and skip sound entirely.
 * Sound is a nice-to-have feature; it must never crash the app.
 *
 * TO FIX PERMANENTLY: rebuild your dev client so expo-av's native module
 * is compiled in. Run: `eas build --profile development --platform android`
 */

let soundObject: any = null;
let avModule: any = null;          // cached after first successful import
let importAttempted = false;       // only try once — avoids repeated crash logs

/**
 * Lazily loads expo-av, caching the result after the first attempt.
 * Returns null if the native module is unavailable (old dev client / Expo Go).
 */
async function getAudioModule(): Promise<any | null> {
  if (avModule) return avModule;
  if (importAttempted) return null;  // already failed — don't try again

  importAttempted = true;
  try {
    const mod = await import('expo-av');
    avModule = mod;
    return mod;
  } catch (e) {
    // ExponentAV native module not found — dev client needs a rebuild.
    // This is NOT a crash — sound is optional.
    console.warn(
      '[sound] expo-av native module unavailable.\n' +
      'Rebuild your dev client to include expo-av: eas build --profile development\n' +
      'Sound features are disabled until then.',
      e
    );
    return null;
  }
}

/**
 * Plays a brief tactile sound when a payment is recorded.
 * Silently no-ops if expo-av is unavailable (old dev client / Expo Go).
 */
export async function playPaymentSound(): Promise<void> {
  try {
    const av = await getAudioModule();
    if (!av) return; // native module unavailable — skip silently

    const { Audio } = av;

    if (soundObject) {
      await soundObject.unloadAsync();
      soundObject = null;
    }

    const { sound } = await Audio.Sound.createAsync(
      require('../assets/sounds/payment.mp3'),
      { shouldPlay: true, volume: 0.8 }
    );
    soundObject = sound;

    sound.setOnPlaybackStatusUpdate((status: any) => {
      if (status.isLoaded && status.didJustFinish) {
        sound.unloadAsync();
        soundObject = null;
      }
    });
  } catch (e) {
    // Sound is a nice-to-have — never let audio failures crash the app
    console.warn('[sound] playPaymentSound failed:', e);
  }
}

/**
 * Returns whether sound notifications are enabled in the user's profile.
 */
export async function isSoundEnabled(): Promise<boolean> {
  try {
    const { loadShopProfile } = await import('../store/shopProfile');
    const profile = await loadShopProfile();
    return profile.notificationSound !== false;
  } catch (e) {
    return false;
  }
}

