import type { StoredRecipe } from '../types';

function ingredientLine(ingredient: StoredRecipe['current_version']['ingredients'][number]): string {
  const qty = [ingredient.quantity, ingredient.unit].filter(Boolean).join(' ').trim();
  return qty ? `${qty} ${ingredient.name}` : ingredient.name;
}

export function buildRecipeHtml(recipe: StoredRecipe): string {
  const version = recipe.current_version;
  const ingredients = version.ingredients.map((i) => `<li>${ingredientLine(i)}</li>`).join('');
  const steps = version.steps.map((s) => `<li>${s.text}</li>`).join('');
  return `
    <html>
      <body style="font-family: -apple-system, sans-serif; padding: 24px;">
        <h1>${recipe.title}</h1>
        <p>${recipe.total_time_minutes} min · ${recipe.cuisine} · serves ${recipe.servings}</p>
        <h2>Ingredients</h2>
        <ul>${ingredients}</ul>
        <h2>Steps</h2>
        <ol>${steps}</ol>
      </body>
    </html>
  `;
}

export function buildRecipePlainText(recipe: StoredRecipe): string {
  const version = recipe.current_version;
  const ingredients = version.ingredients.map((i) => `- ${ingredientLine(i)}`).join('\n');
  const steps = version.steps.map((s, idx) => `${idx + 1}. ${s.text}`).join('\n');
  return `${recipe.title}\n${recipe.total_time_minutes} min · ${recipe.cuisine}\n\nIngredients:\n${ingredients}\n\nSteps:\n${steps}`;
}

export function buildContinueIteratingText(recipe: StoredRecipe): string {
  const version = recipe.current_version;
  const ingredients = version.ingredients.map((i) => `- ${ingredientLine(i)}`).join('\n');
  const steps = version.steps.map((s, idx) => `${idx + 1}. ${s.text}`).join('\n');
  const history = recipe.versions
    .map((v) => `v${v.version_number}${v.change_note ? ` — ${v.change_note}` : ''}`)
    .join('\n');
  return [
    `Recipe: ${recipe.title}`,
    `${recipe.total_time_minutes} min · ${recipe.cuisine} · serves ${recipe.servings}`,
    '',
    'Ingredients:',
    ingredients,
    '',
    'Steps:',
    steps,
    '',
    'Version history:',
    history,
  ].join('\n');
}
