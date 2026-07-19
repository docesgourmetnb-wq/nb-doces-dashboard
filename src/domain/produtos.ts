export function getProdutoNomeBase(nome: string) {
  return nome
    .replace(/\s+\d+(?:[,.]\d+)?\s*g$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getProdutoTamanho(nome: string) {
  return nome.match(/(\d+(?:[,.]\d+)?)\s*g$/i)?.[0].replace(/\s+/g, '') ?? null;
}
