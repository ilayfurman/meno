export const colors = {
  background: '#ffffff',
  // Visual-refresh exploration (Rocket Money inspired): a neutral light-gray
  // canvas sits behind white cards so elevation (shadow) does the work of
  // separating content instead of hairline borders. Deliberately neutral/cool
  // rather than the cream/sand tone Meno used elsewhere — screens use this for
  // their outer background; individual cards stay white on top.
  canvas: '#f2f2f5',
  foreground: '#1c1a17',
  subtext: '#8a8479',
  accent: '#c1552f',
  accent2: '#5c7a52',
  matBackground: '#fbf8f2',
  hairline: '#ece7dc',
  hairlineAlt: '#ece2d0',
  successDot: '#3d8a52',
  offDot: '#cfc7b5',
  // legacy aliases kept during the redesign migration — every screen still
  // referencing these compiles against the new palette without a rewrite
  surface: '#ffffff',
  textPrimary: '#1c1a17',
  textSecondary: '#8a8479',
  primaryAccent: '#c1552f',
  secondaryAccent: '#5c7a52',
  border: '#ece7dc',
  successSoft: '#eef4ec',
  danger: '#c1552f',
  text: '#1c1a17',
  muted: '#8a8479',
};
