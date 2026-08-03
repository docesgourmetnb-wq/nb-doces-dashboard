import test from 'node:test';
import assert from 'node:assert/strict';
import { groupFornecedorPurchaseHistory, summarizeFornecedorPurchases } from './fornecedores.ts';

test('summarizeFornecedorPurchases groups purchases by supplier', () => {
  const summary = summarizeFornecedorPurchases([
    { fornecedor_id: 'fornecedor-1', valor: 20, data: '2026-08-01' },
    { fornecedor_id: 'fornecedor-1', valor: 15.5, data: '2026-08-03' },
    { fornecedor_id: 'fornecedor-2', valor: 8, data: '2026-08-02' },
    { fornecedor_id: 'fornecedor-2', valor: 5, data: null },
    { fornecedor_id: null, valor: 99, data: '2026-08-04' },
  ]);

  assert.deepEqual(summary['fornecedor-1'], {
    totalCompras: 35.5,
    quantidadeCompras: 2,
    ultimaCompra: '2026-08-03',
  });
  assert.deepEqual(summary['fornecedor-2'], {
    totalCompras: 13,
    quantidadeCompras: 2,
    ultimaCompra: '2026-08-02',
  });
  assert.equal(summary['fornecedor-3'], undefined);
});

test('groupFornecedorPurchaseHistory groups stock and loose purchases by supplier and date', () => {
  const groups = groupFornecedorPurchaseHistory([
    {
      id: 'entrada-1',
      fornecedor_id: 'fornecedor-1',
      fornecedor_nome: 'Armazem do Mercado',
      descricao: 'Granule Melken Branco',
      categoria: 'Insumo',
      valor: 143.97,
      data: '2026-08-03',
      origem: 'estoque',
      origem_pagamento: 'fora_caixa',
      created_at: '2026-08-03T18:00:00Z',
    },
    {
      id: 'avulsa-1',
      fornecedor_id: 'fornecedor-1',
      fornecedor_nome: 'Armazem do Mercado',
      descricao: 'Utensilio de producao',
      categoria: 'Utensilios',
      valor: 25,
      data: '2026-08-03',
      origem: 'avulsa',
      origem_pagamento: 'fora_caixa',
      created_at: '2026-08-03T18:10:00Z',
    },
    {
      id: 'entrada-2',
      fornecedor_id: 'fornecedor-2',
      fornecedor_nome: 'Outro fornecedor',
      descricao: 'Chocolate',
      categoria: 'Insumo',
      valor: 50,
      data: null,
      origem: 'estoque',
      origem_pagamento: 'fora_caixa',
      created_at: '2026-08-02T18:00:00Z',
    },
  ]);

  assert.equal(groups.length, 2);
  assert.deepEqual(groups[0], {
    id: 'fornecedor-1:2026-08-03',
    fornecedor_id: 'fornecedor-1',
    fornecedor_nome: 'Armazem do Mercado',
    data: '2026-08-03',
    total: 168.97,
    quantidadeLancamentos: 2,
    itens: [groups[0].itens[0], groups[0].itens[1]],
  });
  assert.equal(groups[1].data, null);
  assert.equal(groups[1].total, 50);
});
