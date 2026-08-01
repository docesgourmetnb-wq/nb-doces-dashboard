export interface PedidoModeloItem {
  quantidade: number;
  preco_unitario: number;
  brigadeiro_id?: string | null;
  brigadeiro_nome: string;
  brigadeiro_categoria?: 'brigadeiro' | 'bolo' | null;
  brigadeiro_tamanho_g?: number | null;
  produto_id?: string | null;
  produto_variacao_id?: string | null;
  produto_categoria?: 'brigadeiro' | 'bolo' | null;
  produto_nome?: string | null;
  produto_variacao_nome?: string | null;
  produto_variacao_tamanho?: string | null;
  produto_variacao_cobertura?: string | null;
}

export interface PedidoModeloOrigem {
  id: string;
  tipo_pedido: 'encomenda' | 'pronta-entrega' | 'evento';
  tipo_entrega: 'retirada' | 'entrega';
  endereco_entrega?: string | null;
  canal_venda: 'whatsapp' | 'instagram';
  forma_pagamento: 'pix' | 'cartao' | 'dinheiro' | 'transferencia';
  packaging_profile_id?: string | null;
  observacoes?: string | null;
  itens?: PedidoModeloItem[];
}

export function buildPedidoRecorrenteFromModelo(modelo: PedidoModeloOrigem) {
  return {
    tipo_pedido: modelo.tipo_pedido,
    tipo_entrega: modelo.tipo_entrega,
    endereco_entrega: modelo.endereco_entrega ?? '',
    canal_venda: modelo.canal_venda,
    forma_pagamento: modelo.forma_pagamento,
    packaging_profile_id: modelo.packaging_profile_id ?? null,
    valor_pago: '',
    observacoes: modelo.observacoes ?? '',
    itens: (modelo.itens ?? []).map((item) => ({ ...item })),
  };
}
