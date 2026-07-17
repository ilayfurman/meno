import { Text, TextInput } from 'react-native';
import { fontFamily } from './fonts';

// Design source of truth (Meno Redesign.dc.html) sets `body{font-family:'DM Sans'}`
// at the root so every element inherits it unless overridden. React Native has no
// equivalent inheritance, so we fake it by patching the default style for every
// Text/TextInput in the app. Anything that needs a heavier weight still sets its
// own `fontFamily` (fontFamily.semiBold/bold/extraBold) explicitly — custom fonts
// loaded as separate static weights don't respond to `fontWeight` the way system
// fonts do, so `fontWeight` alone is not a reliable substitute for this.
let applied = false;

export function applyGlobalTextDefaults() {
  if (applied) {
    return;
  }
  applied = true;

  const anyText = Text as unknown as { defaultProps?: { style?: unknown } };
  anyText.defaultProps = anyText.defaultProps ?? {};
  anyText.defaultProps.style = [{ fontFamily: fontFamily.regular }, anyText.defaultProps.style];

  const anyTextInput = TextInput as unknown as { defaultProps?: { style?: unknown } };
  anyTextInput.defaultProps = anyTextInput.defaultProps ?? {};
  anyTextInput.defaultProps.style = [{ fontFamily: fontFamily.regular }, anyTextInput.defaultProps.style];
}
