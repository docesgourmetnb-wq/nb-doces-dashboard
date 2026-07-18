import { getProdutoNomeBase } from './produtos.ts';

export interface ProductionRecipeMatchOption {
  id: string;
  recipeName: string;
  recipeType: string;
}

export interface ProductionOutputMatchOption {
  id: string;
  nome: string;
  tipo: string;
}

export interface ProductionIntegrationSuggestion {
  recipeVersionId: string;
  outputItemId: string;
}

export function normalizeProductionMatchName(nome: string) {
  return getProdutoNomeBase(nome)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function findBestMatch<T>(
  productName: string,
  options: T[],
  getName: (option: T) => string,
  getType: (option: T) => string,
  preferredTypes: string[],
) {
  const target = normalizeProductionMatchName(productName);
  if (!target) return undefined;

  const scored = options
    .map((option) => {
      const optionName = normalizeProductionMatchName(getName(option));
      const typeIndex = preferredTypes.indexOf(getType(option));
      const typeScore = typeIndex === -1 ? preferredTypes.length : typeIndex;
      const exactScore = optionName === target ? 0 : 1;
      const partialScore = optionName.includes(target) || target.includes(optionName) ? 0 : 1;

      return { option, exactScore, partialScore, typeScore };
    })
    .filter((item) => item.exactScore === 0 || item.partialScore === 0)
    .sort((a, b) =>
      a.exactScore - b.exactScore ||
      a.partialScore - b.partialScore ||
      a.typeScore - b.typeScore
    );

  return scored[0]?.option;
}

export function suggestProductionIntegration(
  productName: string,
  recipes: ProductionRecipeMatchOption[],
  outputItems: ProductionOutputMatchOption[],
): ProductionIntegrationSuggestion | null {
  const recipe = findBestMatch(
    productName,
    recipes,
    (option) => option.recipeName,
    (option) => option.recipeType,
    ['produto_final', 'massa_base'],
  );
  const outputItem = findBestMatch(
    productName,
    outputItems,
    (option) => option.nome,
    (option) => option.tipo,
    ['produto_final', 'massa_base'],
  );

  if (!recipe || !outputItem) return null;

  return {
    recipeVersionId: recipe.id,
    outputItemId: outputItem.id,
  };
}
