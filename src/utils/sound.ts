/**
 * src/utils/sound.ts
 *
 * Uses expo-audio (the official replacement for the deprecated expo-av Audio API).
 * Sound is a nice-to-have feature and must never crash the app — all errors are
 * caught and silently logged.
 */

import { createAudioPlayer, AudioPlayer } from 'expo-audio';

let player: AudioPlayer | null = null;

/**
 * Plays a brief tactile sound when a payment is recorded.
 * Silently no-ops if audio is unavailable.
 */
export async function playPaymentSound(): Promise<void> {
  try {
    // Release previous player instance to free resources
    if (player) {
      player.remove();
      player = null;
    }

    player = createAudioPlayer(require('../assets/sounds/payment.mp3'));
    player.play();
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
