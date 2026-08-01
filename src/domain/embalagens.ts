export interface PackagingProfileSummaryInput {
  itemsCount: number;
  totalQuantity: number;
}

export function summarizePackagingProfileItems(items: Array<{ quantidade_por_pedido: number }>): PackagingProfileSummaryInput {
  return items.reduce(
    (summary, item) => {
      if (!Number.isFinite(item.quantidade_por_pedido) || item.quantidade_por_pedido <= 0) {
        return summary;
      }

      return {
        itemsCount: summary.itemsCount + 1,
        totalQuantity: summary.totalQuantity + item.quantidade_por_pedido,
      };
    },
    {
      itemsCount: 0,
      totalQuantity: 0,
    },
  );
}

export function validatePackagingItemQuantity(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error('Quantidade por pedido invalida');
  }

  return value;
}
