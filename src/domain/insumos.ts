export const INSUMO_UNIDADES = [
  { value: 'g', label: 'Gramas (g)', placeholder: 'Ex: 395' },
  { value: 'kg', label: 'Quilos (kg)', placeholder: 'Ex: 1,5' },
  { value: 'ml', label: 'Mililitros (ml)', placeholder: 'Ex: 50' },
  { value: 'l', label: 'Litros (l)', placeholder: 'Ex: 1' },
  { value: 'un', label: 'Unidades (un)', placeholder: 'Ex: 12' },
] as const;

export type InsumoUnidade = (typeof INSUMO_UNIDADES)[number]['value'];

export function isInsumoUnidadePadrao(unidade: string): unidade is InsumoUnidade {
  return INSUMO_UNIDADES.some((option) => option.value === unidade);
}

export function getInsumoUnidadeLabel(unidade: string) {
  return INSUMO_UNIDADES.find((option) => option.value === unidade)?.label ?? unidade;
}

export function getInsumoQuantidadePlaceholder(unidade: string) {
  return INSUMO_UNIDADES.find((option) => option.value === unidade)?.placeholder ?? 'Ex: 1';
}

export interface InsumoCadastroInput {
  nome: string;
  unidade: string;
  quantidadeMinima: number;
}

export function buildInsumoCadastroDefaults(input: InsumoCadastroInput) {
  return {
    nome: input.nome.trim(),
    unidade: input.unidade,
    quantidade_atual: 0,
    quantidade_minima: input.quantidadeMinima,
    consumo_medio: 0,
    preco_unitario: 0,
  };
}
