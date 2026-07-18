export function getProdutoNomeBase(nome: string) {
  return nome
    .replace(/\s+\d+(?:[,.]\d+)?\s*g$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}
