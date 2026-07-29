import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateInsumoEntry,
  calculateInsumoExit,
  calculateInsumoPackageEquivalent,
  calculateInsumoPurchaseQuantity,
  formatInsumoPackageReference,
  getInsumoEntryModePadrao,
  getInsumoStockStatus,
  summarizeKnownInsumoStockValue,
} from './estoque.ts';

test('getInsumoEntryModePadrao opens centimeter stock as loose quantity', () => {
  assert.equal(getInsumoEntryModePadrao('cm'), 'quantidade');
  assert.equal(getInsumoEntryModePadrao('un'), 'embalagens');
  assert.equal(getInsumoEntryModePadrao('g'), 'embalagens');
});

test('getInsumoStockStatus ignores alerts when minimum stock is not defined', () => {
  assert.deepEqual(getInsumoStockStatus(0, 0), {
    status: 'unset',
    progressValue: 0,
    needsAttention: false,
  });
});

test('getInsumoStockStatus returns critical, low and ok statuses', () => {
  assert.equal(getInsumoStockStatus(4, 10).status, 'critical');
  assert.equal(getInsumoStockStatus(10, 10).status, 'low');
  assert.equal(getInsumoStockStatus(15, 10).status, 'ok');
});

test('calculateInsumoEntry adds quantity and calculates latest unit cost', () => {
  assert.deepEqual(calculateInsumoEntry(100, 50, 25), {
    quantidadeAtual: 150,
    precoUnitario: 0.5,
  });
});

test('calculateInsumoEntry rejects invalid entry values', () => {
  assert.throws(() => calculateInsumoEntry(100, 0, 25), /Quantidade/);
  assert.throws(() => calculateInsumoEntry(100, 10, -1), /Valor/);
});

test('calculateInsumoExit subtracts quantity without allowing negative stock', () => {
  assert.deepEqual(calculateInsumoExit(100, 35), {
    quantidadeAtual: 65,
  });
  assert.deepEqual(calculateInsumoExit(100, 100), {
    quantidadeAtual: 0,
  });
});

test('calculateInsumoExit rejects invalid or excessive quantity', () => {
  assert.throws(() => calculateInsumoExit(100, 0), /saída/);
  assert.throws(() => calculateInsumoExit(100, 101), /Saldo insuficiente/);
  assert.throws(() => calculateInsumoExit(-1, 1), /Saldo/);
});

test('calculateInsumoPurchaseQuantity calculates total from packages and content', () => {
  assert.equal(calculateInsumoPurchaseQuantity(10, 395), 3950);
  assert.equal(calculateInsumoPurchaseQuantity(2, 1.5), 3);
});

test('calculateInsumoPurchaseQuantity rejects invalid package values', () => {
  assert.throws(() => calculateInsumoPurchaseQuantity(0, 395), /embalagens/);
  assert.throws(() => calculateInsumoPurchaseQuantity(10, 0), /Conteúdo/);
});

test('calculateInsumoPackageEquivalent derives package count from current stock', () => {
  assert.equal(calculateInsumoPackageEquivalent(5530, 395), 14);
  assert.equal(calculateInsumoPackageEquivalent(197.5, 395), 0.5);
});

test('calculateInsumoPackageEquivalent ignores invalid package references', () => {
  assert.equal(calculateInsumoPackageEquivalent(5530, 0), null);
  assert.equal(calculateInsumoPackageEquivalent(-1, 395), null);
});

test('formatInsumoPackageReference shows whole package counts for closed units', () => {
  assert.equal(formatInsumoPackageReference(5530, 395, 'g'), '14 embalagens de 395 g');
});

test('formatInsumoPackageReference avoids decimal package labels for fractional stock', () => {
  assert.equal(formatInsumoPackageReference(505, 1000, 'g'), '505 g disponíveis · 50,5% de uma embalagem de 1.000 g');
});

test('formatInsumoPackageReference can omit available quantity for movement history', () => {
  assert.equal(
    formatInsumoPackageReference(505, 1000, 'g', { includeAvailableQuantity: false }),
    '50,5% de uma embalagem de 1.000 g',
  );
});

test('formatInsumoPackageReference ignores invalid package references', () => {
  assert.equal(formatInsumoPackageReference(505, 0, 'g'), null);
});

test('summarizeKnownInsumoStockValue keeps historical stock without cost valued as zero', () => {
  assert.deepEqual(
    summarizeKnownInsumoStockValue(
      [{ id: 'leite-condensado', quantidadeAtual: 10000 }],
      [{ insumoId: 'leite-condensado', quantidade: 10000, valorTotal: 0 }],
    ),
    {
      valorConhecido: 0,
      insumosComSaldoSemCusto: 1,
    },
  );
});

test('summarizeKnownInsumoStockValue values only entries with real purchase cost', () => {
  assert.deepEqual(
    summarizeKnownInsumoStockValue(
      [{ id: 'leite-condensado', quantidadeAtual: 11000 }],
      [
        { insumoId: 'leite-condensado', quantidade: 10000, valorTotal: 0 },
        { insumoId: 'leite-condensado', quantidade: 1000, valorTotal: 20 },
      ],
    ),
    {
      valorConhecido: 20,
      insumosComSaldoSemCusto: 1,
    },
  );
});

test('summarizeKnownInsumoStockValue caps known value by current physical stock', () => {
  assert.deepEqual(
    summarizeKnownInsumoStockValue(
      [{ id: 'cacau', quantidadeAtual: 500 }],
      [{ insumoId: 'cacau', quantidade: 1000, valorTotal: 40 }],
    ),
    {
      valorConhecido: 20,
      insumosComSaldoSemCusto: 0,
    },
  );
});
