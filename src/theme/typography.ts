export const typography = {
  screenTitle: { fontSize: 28, fontWeight: '800' as const, letterSpacing: -0.5 },
  sectionKicker: { fontSize: 11, fontWeight: '700' as const, letterSpacing: 0.6, textTransform: 'uppercase' as const },
  cardTitle: { fontSize: 15, fontWeight: '700' as const },
  tag: { fontSize: 11, fontWeight: '700' as const },
  // legacy aliases kept during the redesign migration
  titleLarge: 28,
  sectionHeader: 22,
  body: 16,
  chip: 14,
};

// DM Sans / JetBrains Mono are the design spec's fonts but aren't bundled yet —
// using the system font for this pass. Add via expo-font + @expo-google-fonts/dm-sans
// in a follow-up; it's a pure asset-loading addition orthogonal to this layout rebuild.
