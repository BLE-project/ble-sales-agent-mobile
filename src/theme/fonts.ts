import {
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';
import { Inter_400Regular, Inter_600SemiBold } from '@expo-google-fonts/inter';
import {
  JetBrainsMono_400Regular,
  // ponytail: typography.ts's monoAmount references a nonexistent
  // 'JetBrainsMono_600Medium' export (pre-existing bug, mono out of scope
  // this pass) — preload the real 500Medium weight so it's at least
  // available if that string gets corrected later.
  JetBrainsMono_500Medium,
} from '@expo-google-fonts/jetbrains-mono';
import {
  BricolageGrotesque_600SemiBold,
  BricolageGrotesque_700Bold,
} from '@expo-google-fonts/bricolage-grotesque';
import {
  HankenGrotesk_400Regular,
  HankenGrotesk_600SemiBold,
} from '@expo-google-fonts/hanken-grotesk';
import type { FontSource } from 'expo-font';

/**
 * «La Piazza» font preload — pattern from consumer-mobile's src/fonts/fonts.ts.
 *
 * typography.ts references BricolageGrotesque_* (display) and
 * HankenGrotesk_* (body/title/label) — those families must be loaded via
 * expo-font before first render or RN silently falls back to the system
 * font. SpaceGrotesk/Inter/JetBrainsMono are kept loaded too: the `tag` /
 * `monoAmount` styles still use JetBrainsMono, and other in-flight branches
 * may still reference the old families until this rollout completes.
 */
export function getAppFontMap(): Record<string, FontSource> {
  return {
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
    Inter_400Regular,
    Inter_600SemiBold,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
    BricolageGrotesque_600SemiBold,
    BricolageGrotesque_700Bold,
    HankenGrotesk_400Regular,
    HankenGrotesk_600SemiBold,
  };
}
