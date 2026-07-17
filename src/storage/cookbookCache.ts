// Deliberately empty: an earlier version of this file cached the cookbook
// list in AsyncStorage to avoid a blank-grid flash on open. That's been
// replaced with a plain loading spinner instead (see CookbookScreen) since
// persisting recipe data to on-device storage wasn't wanted. Kept as an
// empty module rather than deleted because this project's mounted
// filesystem doesn't allow removing files from here.
export {};
