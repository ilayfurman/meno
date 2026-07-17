// Deliberately empty: this used to store the on-device Face ID Lock
// preference. That feature has been removed entirely -- Clerk's own
// persistent session (see App.tsx's tokenCache) is the only "stay signed
// in" mechanism this app uses now. Kept as an empty module rather than
// deleted because this project's mounted filesystem doesn't allow removing
// files from here.
export {};
