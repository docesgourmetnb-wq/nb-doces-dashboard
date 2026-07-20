export type RecipeMassComponent = {
  qty_per_batch: number;
  uom: string;
};

export function convertRecipeComponentQtyToGrams(qty: number, uom: string) {
  if (!Number.isFinite(qty) || qty <= 0) return null;

  switch (uom.toLowerCase()) {
    case 'g':
      return qty;
    case 'kg':
      return qty * 1000;
    case 'ml':
      return qty;
    case 'l':
      return qty * 1000;
    default:
      return null;
  }
}

export function summarizeRecipeMass(components: RecipeMassComponent[]) {
  return components.reduce(
    (summary, component) => {
      const grams = convertRecipeComponentQtyToGrams(component.qty_per_batch, component.uom);

      if (grams === null) {
        return {
          ...summary,
          ignoredComponents: summary.ignoredComponents + 1,
        };
      }

      return {
        ...summary,
        totalGrams: summary.totalGrams + grams,
        calculableComponents: summary.calculableComponents + 1,
      };
    },
    { totalGrams: 0, calculableComponents: 0, ignoredComponents: 0 },
  );
}
