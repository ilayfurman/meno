import { Platform } from 'react-native';

// Rocket-Money-inspired "3D" card feel: soft, low-contrast drop shadow instead
// of a hairline border. iOS reads shadowColor/Offset/Opacity/Radius; Android
// only respects `elevation`, so both are provided everywhere this is spread.
function shadow(opacity: number, radius: number, offsetY: number, elevation: number) {
  return Platform.select({
    android: { elevation },
    default: {
      shadowColor: '#1c1a17',
      shadowOffset: { width: 0, height: offsetY },
      shadowOpacity: opacity,
      shadowRadius: radius,
    },
  });
}

export const elevation = {
  // Recipe cards, stat tiles, grouped list boxes — the everyday card lift.
  card: shadow(0.07, 12, 4, 2),
  // Plan card, bottom sheets, anything meant to feel like it's floating higher.
  raised: shadow(0.12, 20, 8, 6),
  // Tab bar's separation from content behind it.
  tabBar: shadow(0.08, 16, -2, 8),
};
