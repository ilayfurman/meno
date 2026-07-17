// Deliberately empty: this app no longer uses a Face ID / biometric re-lock
// layer on top of the Clerk session -- persistent sign-in already comes
// from Clerk's own secure-store-backed token cache (see App.tsx /
// ClerkAuthGate.tsx), which is all this app needs. Kept as an empty module
// rather than deleted because this project's mounted filesystem doesn't
// allow removing files from here.
export {};
