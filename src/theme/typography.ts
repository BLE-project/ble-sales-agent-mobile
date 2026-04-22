import { TextStyle } from 'react-native';

export const typography: Record<string, TextStyle> = {
  displayXl:   { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 32, lineHeight: 36 },
  displayL:    { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 24, lineHeight: 30 },
  displayM:    { fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 20, lineHeight: 26 },
  titleL:      { fontFamily: 'Inter_600SemiBold', fontSize: 18, lineHeight: 24 },
  titleM:      { fontFamily: 'Inter_600SemiBold', fontSize: 16, lineHeight: 22 },
  bodyL:       { fontFamily: 'Inter_400Regular', fontSize: 16, lineHeight: 22 },
  bodyM:       { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20 },
  bodyS:       { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 16 },
  label:       { fontFamily: 'Inter_600SemiBold', fontSize: 11, lineHeight: 14 },
  tag:         { fontFamily: 'JetBrainsMono_400Regular', fontSize: 10, lineHeight: 14,
                 letterSpacing: 0.8, textTransform: 'uppercase' },
  monoAmount:  { fontFamily: 'JetBrainsMono_600Medium', fontSize: 22, lineHeight: 26 },
};
