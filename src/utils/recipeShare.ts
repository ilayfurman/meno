import type { Recipe } from '../types';

function recipeToText(recipe: Recipe): string {
  const ingredients = recipe.ingredients
    .map((item) => `- ${item.quantity} ${item.unit} ${item.name}${item.notes ? ` (${item.notes})` : ''}`)
    .join('\n');

  const steps = recipe.steps.map((step) => `${step.idx}. ${step.text}`).join('\n');

  return [
    `${recipe.title}`,
    `${recipe.total_time_minutes} min · ${recipe.difficulty} · Serves ${recipe.servings}`,
    '',
    'Ingredients',
    ingredients,
    '',
    'Steps',
    steps,
  ].join('\n');
}

export function buildSingleRecipeShare(recipe: Recipe): string {
  return recipeToText(recipe);
}

export function buildMultiRecipeShare(recipes: Recipe[]): string {
  return recipes.map((recipe, index) => `${index + 1}) ${recipeToText(recipe)}`).join('\n\n---\n\n');
}
