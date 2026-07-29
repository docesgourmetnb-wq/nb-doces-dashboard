export const INSUMO_UNIDADES = [
  { value: 'g', label: 'Gramas (g)', placeholder: 'Ex: 395' },
  { value: 'kg', label: 'Quilos (kg)', placeholder: 'Ex: 1,5' },
  { value: 'ml', label: 'Mililitros (ml)', placeholder: 'Ex: 50' },
  { value: 'l', label: 'Litros (l)', placeholder: 'Ex: 1' },
  { value: 'un', label: 'Unidades (un)', placeholder: 'Ex: 12' },
] as const;

export type InsumoUnidade = (typeof INSUMO_UNIDADES)[number]['value'];

export const INSUMO_TIPOS_ESTOQUE = [
  { value: 'producao', label: 'Insumo de produção' },
  { value: 'embalagem', label: 'Embalagem' },
] as const;

export type InsumoTipoEstoque = (typeof INSUMO_TIPOS_ESTOQUE)[number]['value'];

export function isInsumoTipoEstoque(tipo: string): tipo is InsumoTipoEstoque {
  return INSUMO_TIPOS_ESTOQUE.some((option) => option.value === tipo);
}

export function getInsumoTipoEstoqueLabel(tipo: string | null | undefined) {
  return INSUMO_TIPOS_ESTOQUE.find((option) => option.value === tipo)?.label ?? 'Insumo de produção';
}

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
  tipoEstoque?: InsumoTipoEstoque;
}

export function buildInsumoCadastroDefaults(input: InsumoCadastroInput) {
  return {
    nome: input.nome.trim(),
    unidade: input.unidade,
    tipo_estoque: input.tipoEstoque ?? 'producao',
    quantidade_atual: 0,
    quantidade_minima: input.quantidadeMinima,
    consumo_medio: 0,
    preco_unitario: 0,
  };
}
