import type { Ingredient } from '../types';

export type UnitSystem = 'original' | 'metric' | 'us';

interface ConversionRule {
  toUnit: string;
  factor: number;
  round: number;
}

const toMetric: Record<string, ConversionRule> = {
  oz: { toUnit: 'g', factor: 28.3495, round: 1 },
  ounce: { toUnit: 'g', factor: 28.3495, round: 1 },
  ounces: { toUnit: 'g', factor: 28.3495, round: 1 },
  lb: { toUnit: 'g', factor: 453.592, round: 1 },
  lbs: { toUnit: 'g', factor: 453.592, round: 1 },
  pound: { toUnit: 'g', factor: 453.592, round: 1 },
  pounds: { toUnit: 'g', factor: 453.592, round: 1 },
  'fl oz': { toUnit: 'ml', factor: 29.5735, round: 1 },
  'fluid ounce': { toUnit: 'ml', factor: 29.5735, round: 1 },
  cup: { toUnit: 'ml', factor: 236.588, round: 1 },
  cups: { toUnit: 'ml', factor: 236.588, round: 1 },
  tbsp: { toUnit: 'ml', factor: 14.7868, round: 1 },
  tablespoon: { toUnit: 'ml', factor: 14.7868, round: 1 },
  tablespoons: { toUnit: 'ml', factor: 14.7868, round: 1 },
  tsp: { toUnit: 'ml', factor: 4.92892, round: 1 },
  teaspoon: { toUnit: 'ml', factor: 4.92892, round: 1 },
  teaspoons: { toUnit: 'ml', factor: 4.92892, round: 1 },
};

const toUs: Record<string, ConversionRule> = {
  g: { toUnit: 'oz', factor: 0.035274, round: 0.25 },
  gram: { toUnit: 'oz', factor: 0.035274, round: 0.25 },
  grams: { toUnit: 'oz', factor: 0.035274, round: 0.25 },
  kg: { toUnit: 'lb', factor: 2.20462, round: 0.25 },
  ml: { toUnit: 'fl oz', factor: 0.033814, round: 0.25 },
  l: { toUnit: 'cup', factor: 4.22675, round: 0.25 },
};

function normalizeUnit(unit: string): string {
  return unit.trim().toLowerCase().replace(/\./g, '');
}

function roundToStep(value: number, step: number): number {
  return Math.round(value / step) * step;
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return '';
  }
  const formatted = value.toFixed(2);
  return formatted.replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
}

function parseLeadingQuantity(text: string): { value: number; token: string } | null {
  const trimmed = text.trim();
  const mixedMatch = trimmed.match(/^(\d+)\s+(\d+)\/(\d+)/);
  if (mixedMatch) {
    const [, whole, num, den] = mixedMatch;
    const fraction = Number(num) / Number(den);
    return { value: Number(whole) + fraction, token: mixedMatch[0] };
  }

  const fractionMatch = trimmed.match(/^(\d+)\/(\d+)/);
  if (fractionMatch) {
    const [, num, den] = fractionMatch;
    return { value: Number(num) / Number(den), token: fractionMatch[0] };
  }

  const decimalMatch = trimmed.match(/^\d*\.?\d+/);
  if (decimalMatch) {
    return { value: Number(decimalMatch[0]), token: decimalMatch[0] };
  }

  return null;
}

function scaleQuantityText(quantity: string, factor: number): string {
  const parsed = parseLeadingQuantity(quantity);
  if (!parsed) {
    return quantity;
  }
  const scaled = parsed.value * factor;
  return quantity.replace(parsed.token, formatNumber(scaled));
}

function scaleNumericQuantity(value: number, factor: number): number {
  return value * factor;
}

function convertQuantityAndUnit(
  quantity: string,
  unit: string,
  unitSystem: UnitSystem,
): { quantity: string; unit: string } {
  if (unitSystem === 'original') {
    return { quantity, unit };
  }

  const parsed = parseLeadingQuantity(quantity);
  if (!parsed) {
    return { quantity, unit };
  }

  const normalizedUnit = normalizeUnit(unit);
  const table = unitSystem === 'metric' ? toMetric : toUs;
  const rule = table[normalizedUnit];
  if (!rule) {
    return { quantity, unit };
  }

  const convertedValue = roundToStep(parsed.value * rule.factor, rule.round);
  return {
    quantity: quantity.replace(parsed.token, formatNumber(convertedValue)),
    unit: rule.toUnit,
  };
}

export function getDisplayIngredients(params: {
  ingredients: Ingredient[];
  baseServings: number;
  targetServings: number;
  unitSystem: UnitSystem;
}): Ingredient[] {
  const { ingredients, baseServings, targetServings, unitSystem } = params;
  const safeBase = baseServings > 0 ? baseServings : 1;
  const factor = targetServings / safeBase;

  return ingredients.map((ingredient) => {
    if (typeof ingredient.quantity_value === 'number' && Number.isFinite(ingredient.quantity_value)) {
      const scaledNumeric = scaleNumericQuantity(ingredient.quantity_value, factor);
      const baseUnit = ingredient.quantity_unit ?? ingredient.unit;
      const converted = convertQuantityAndUnit(formatNumber(scaledNumeric), baseUnit, unitSystem);
      return {
        ...ingredient,
        quantity: converted.quantity || ingredient.quantity,
        unit: converted.unit || ingredient.unit,
        quantity_value: scaledNumeric,
        quantity_unit: baseUnit,
        quantity_text: ingredient.quantity_text ?? ingredient.quantity,
      };
    }

    if (ingredient.quantity_text) {
      const scaledFromText = scaleQuantityText(ingredient.quantity_text, factor);
      const convertedFromText = convertQuantityAndUnit(scaledFromText, ingredient.unit, unitSystem);
      return {
        ...ingredient,
        quantity: convertedFromText.quantity,
        unit: convertedFromText.unit,
      };
    }

    const scaledQuantity = scaleQuantityText(ingredient.quantity, factor);
    const converted = convertQuantityAndUnit(scaledQuantity, ingredient.unit, unitSystem);
    return {
      ...ingredient,
      quantity: converted.quantity,
      unit: converted.unit,
    };
  });
}
