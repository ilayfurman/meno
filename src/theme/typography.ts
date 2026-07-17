import { fontFamily } from './fonts';

export const typography = {
  screenTitle: { fontFamily: fontFamily.extraBold, fontSize: 28, letterSpacing: -0.5 },
  sectionKicker: {
    fontFamily: fontFamily.bold,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase' as const,
  },
  cardTitle: { fontFamily: fontFamily.bold, fontSize: 15 },
  body: { fontFamily: fontFamily.regular, fontSize: 13 },
  tag: { fontFamily: fontFamily.monoSemiBold, fontSize: 11 },
  versionPill: { fontFamily: fontFamily.monoBold, fontSize: 12 },
  // legacy aliases kept during the redesign migration
  titleLarge: 28,
  sectionHeader: 22,
  chip: 14,
};
