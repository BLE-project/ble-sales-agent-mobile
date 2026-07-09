import { TextStyle } from 'react-native';

// «La Piazza»: display → Bricolage Grotesque, body/title/label → Hanken
// Grotesk. Mono (tag/monoAmount) invariato — fuori scope questo giro.
export const typography: Record<string, TextStyle> = {
  displayXl:   { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 32, lineHeight: 36 },
  displayL:    { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 24, lineHeight: 30 },
  displayM:    { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 20, lineHeight: 26 },
  titleL:      { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 18, lineHeight: 24 },
  titleM:      { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 16, lineHeight: 22 },
  bodyL:       { fontFamily: 'HankenGrotesk_400Regular', fontSize: 16, lineHeight: 22 },
  bodyM:       { fontFamily: 'HankenGrotesk_400Regular', fontSize: 14, lineHeight: 20 },
  bodyS:       { fontFamily: 'HankenGrotesk_400Regular', fontSize: 12, lineHeight: 16 },
  label:       { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 11, lineHeight: 14 },
  tag:         { fontFamily: 'JetBrainsMono_400Regular', fontSize: 10, lineHeight: 14,
                 letterSpacing: 0.8, textTransform: 'uppercase' },
  monoAmount:  { fontFamily: 'JetBrainsMono_600Medium', fontSize: 22, lineHeight: 26 },
};
