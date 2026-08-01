import test from 'node:test';
import assert from 'node:assert/strict';

import { buildPedidoRecorrenteFromModelo } from './pedidoModelos.ts';

test('buildPedidoRecorrenteFromModelo copies operational data and clears payment', () => {
  const copy = buildPedidoRecorrenteFromModelo({
    id: 'pedido-1',
    tipo_pedido: 'encomenda',
    tipo_entrega: 'retirada',
    endereco_entrega: null,
    canal_venda: 'whatsapp',
    forma_pagamento: 'pix',
    packaging_profile_id: 'modelo-bares',
    observacoes: 'Pedido padrao do bar',
    itens: [
      {
        brigadeiro_id: 'brig-1',
        brigadeiro_nome: 'Branquinho',
        brigadeiro_categoria: 'brigadeiro',
        brigadeiro_tamanho_g: 25,
        quantidade: 35,
        preco_unitario: 3,
      },
    ],
  });

  assert.equal(copy.tipo_pedido, 'encomenda');
  assert.equal(copy.tipo_entrega, 'retirada');
  assert.equal(copy.canal_venda, 'whatsapp');
  assert.equal(copy.forma_pagamento, 'pix');
  assert.equal(copy.packaging_profile_id, 'modelo-bares');
  assert.equal(copy.valor_pago, '');
  assert.deepEqual(copy.itens, [
    {
      brigadeiro_id: 'brig-1',
      brigadeiro_nome: 'Branquinho',
      brigadeiro_categoria: 'brigadeiro',
      brigadeiro_tamanho_g: 25,
      quantidade: 35,
      preco_unitario: 3,
    },
  ]);
});

test('buildPedidoRecorrenteFromModelo returns independent item copies', () => {
  const sourceItem = {
    brigadeiro_id: 'brig-1',
    brigadeiro_nome: 'Branquinho',
    quantidade: 35,
    preco_unitario: 3,
  };

  const copy = buildPedidoRecorrenteFromModelo({
    id: 'pedido-1',
    tipo_pedido: 'encomenda',
    tipo_entrega: 'retirada',
    canal_venda: 'whatsapp',
    forma_pagamento: 'pix',
    itens: [sourceItem],
  });

  const copiedItem = copy.itens[0];
  assert.ok(copiedItem);
  copiedItem.quantidade = 40;

  assert.equal(sourceItem.quantidade, 35);
  assert.equal(copiedItem.quantidade, 40);
});
