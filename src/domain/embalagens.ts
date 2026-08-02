export interface PackagingProfileSummaryInput {
  itemsCount: number;
  totalQuantity: number;
  knownCost: number;
  itemsWithKnownCost: number;
  itemsWithoutKnownCost: number;
}

export function summarizePackagingProfileItems(
  items: Array<{
    quantidade_por_pedido: number;
    insumos?: { preco_unitario?: number | null } | null;
  }>,
): PackagingProfileSummaryInput {
  return items.reduce(
    (summary, item) => {
      if (!Number.isFinite(item.quantidade_por_pedido) || item.quantidade_por_pedido <= 0) {
        return summary;
      }

      const unitCost = Number(item.insumos?.preco_unitario ?? 0);
      const hasKnownCost = Number.isFinite(unitCost) && unitCost > 0;

      return {
        itemsCount: summary.itemsCount + 1,
        totalQuantity: summary.totalQuantity + item.quantidade_por_pedido,
        knownCost: summary.knownCost + (hasKnownCost ? item.quantidade_por_pedido * unitCost : 0),
        itemsWithKnownCost: summary.itemsWithKnownCost + (hasKnownCost ? 1 : 0),
        itemsWithoutKnownCost: summary.itemsWithoutKnownCost + (hasKnownCost ? 0 : 1),
      };
    },
    {
      itemsCount: 0,
      totalQuantity: 0,
      knownCost: 0,
      itemsWithKnownCost: 0,
      itemsWithoutKnownCost: 0,
    },
  );
}

export function validatePackagingItemQuantity(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error('Quantidade por pedido invalida');
  }

  return value;
}
