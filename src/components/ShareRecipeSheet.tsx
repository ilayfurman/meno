// Deliberately empty: this used to be a bottom sheet offering three ways to
// share a recipe (Meno link, PDF, plain text). Per product decision, the
// share icon in RecipeDetailScreen now goes straight to the PDF flow
// (formerly "Share as PDF" here) instead of asking -- a PDF opens fine in
// any AI assistant or messaging app, so the other two options were dropped
// rather than kept behind a menu nobody needed. See handleShare in
// RecipeDetailScreen.tsx for the surviving logic. Kept as an empty module
// rather than deleted because this project's mounted filesystem doesn't
// allow removing files from here.
export {};
