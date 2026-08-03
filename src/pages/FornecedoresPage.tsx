import { useState } from 'react';
import { Building2, CalendarDays, Edit2, Loader2, Mail, Phone, Plus, Search, ShoppingCart, Trash2 } from 'lucide-react';
import { useFornecedores, type Fornecedor } from '@/hooks/useFornecedores';
import { useFornecedorPurchaseSummary } from '@/hooks/useFornecedorPurchaseSummary';
import { useFornecedorPurchases } from '@/hooks/useFornecedorPurchases';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { parseDecimalInput } from '@/domain/numeros';
import { cn, formatCurrencyBRL, formatLocalDate } from '@/lib/utils';

const COMPRA_AVULSA_CATEGORIAS = ['Utensilios', 'Equipamentos', 'Limpeza', 'Outros'] as const;

function formatQuantity(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPurchaseItemDetail(item: {
  quantidade: number | null;
  unidade: string | null;
  quantidade_embalagens: number | null;
  conteudo_por_embalagem: number | null;
  valor: number;
}) {
  const details: string[] = [];

  if (item.quantidade_embalagens && item.conteudo_por_embalagem && item.unidade) {
    const unitPrice = item.valor / item.quantidade_embalagens;
    details.push(`${formatQuantity(item.quantidade_embalagens)} emb. x ${formatQuantity(item.conteudo_por_embalagem)} ${item.unidade}`);
    details.push(`${formatCurrencyBRL(unitPrice)} / emb.`);
  } else if (item.quantidade && item.unidade) {
    details.push(`${formatQuantity(item.quantidade)} ${item.unidade}`);
  }

  if (item.quantidade && item.unidade) {
    details.push(`${formatCurrencyBRL(item.valor / item.quantidade)} / ${item.unidade}`);
  }

  return details.join(' • ');
}

export function FornecedoresPage() {
  const { fornecedores, loading, addFornecedor, updateFornecedor, deleteFornecedor } = useFornecedores();
  const { summaryByFornecedorId, loading: loadingPurchaseSummary, refetch: refetchPurchaseSummary } = useFornecedorPurchaseSummary();
  const { historyGroups, loading: loadingPurchaseHistory, addLoosePurchase } = useFornecedorPurchases();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);
  const [editingFornecedor, setEditingFornecedor] = useState<Fornecedor | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [purchaseFormLoading, setPurchaseFormLoading] = useState(false);
  const [nome, setNome] = useState('');
  const [documento, setDocumento] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [ativo, setAtivo] = useState(true);
  const [purchaseFornecedorId, setPurchaseFornecedorId] = useState('');
  const [purchaseDescricao, setPurchaseDescricao] = useState('');
  const [purchaseCategoria, setPurchaseCategoria] = useState<typeof COMPRA_AVULSA_CATEGORIAS[number]>('Utensilios');
  const [purchaseValor, setPurchaseValor] = useState('');
  const [purchaseData, setPurchaseData] = useState('');
  const [purchaseOrigemPagamento, setPurchaseOrigemPagamento] = useState<'fora_caixa' | 'caixa'>('fora_caixa');
  const [purchaseObservacoes, setPurchaseObservacoes] = useState('');

  const filteredFornecedores = fornecedores.filter((fornecedor) => {
    const termo = search.toLowerCase();
    return fornecedor.nome.toLowerCase().includes(termo)
      || fornecedor.documento?.toLowerCase().includes(termo)
      || fornecedor.email?.toLowerCase().includes(termo)
      || fornecedor.telefone?.includes(search);
  });

  const resetForm = () => {
    setNome('');
    setDocumento('');
    setTelefone('');
    setEmail('');
    setObservacoes('');
    setAtivo(true);
    setEditingFornecedor(null);
  };

  const resetPurchaseForm = () => {
    setPurchaseFornecedorId('');
    setPurchaseDescricao('');
    setPurchaseCategoria('Utensilios');
    setPurchaseValor('');
    setPurchaseData('');
    setPurchaseOrigemPagamento('fora_caixa');
    setPurchaseObservacoes('');
  };

  const openEditDialog = (fornecedor: Fornecedor) => {
    setEditingFornecedor(fornecedor);
    setNome(fornecedor.nome);
    setDocumento(fornecedor.documento || '');
    setTelefone(fornecedor.telefone || '');
    setEmail(fornecedor.email || '');
    setObservacoes(fornecedor.observacoes || '');
    setAtivo(fornecedor.ativo);
    setDialogOpen(true);
  };

  const openPurchaseDialog = (fornecedor: Fornecedor) => {
    resetPurchaseForm();
    setPurchaseFornecedorId(fornecedor.id);
    setPurchaseDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!nome.trim()) return;

    setFormLoading(true);
    try {
      const payload = {
        nome: nome.trim(),
        documento: documento.trim() || null,
        telefone: telefone.trim() || null,
        email: email.trim() || null,
        observacoes: observacoes.trim() || null,
        ativo,
      };

      if (editingFornecedor) {
        await updateFornecedor(editingFornecedor.id, payload);
      } else {
        await addFornecedor(payload);
      }

      setDialogOpen(false);
      resetForm();
    } finally {
      setFormLoading(false);
    }
  };

  const handlePurchaseSubmit = async () => {
    const valor = parseDecimalInput(purchaseValor);
    if (!purchaseFornecedorId || !purchaseDescricao.trim() || !Number.isFinite(valor) || valor <= 0) return;

    setPurchaseFormLoading(true);
    try {
      const created = await addLoosePurchase({
        fornecedorId: purchaseFornecedorId,
        descricao: purchaseDescricao.trim(),
        categoria: purchaseCategoria,
        valorTotal: valor,
        dataCompra: purchaseData || null,
        origemPagamento: purchaseOrigemPagamento,
        observacoes: purchaseObservacoes.trim() || null,
      });

      if (created) {
        await refetchPurchaseSummary();
        setPurchaseDialogOpen(false);
        resetPurchaseForm();
      }
    } finally {
      setPurchaseFormLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold text-foreground">Fornecedores</h1>
          <p className="text-muted-foreground mt-1">Gerencie contatos de compras e insumos</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus size={18} />
              Novo Fornecedor
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-display text-xl">
                {editingFornecedor ? 'Editar Fornecedor' : 'Novo Fornecedor'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="fornecedor-nome">Nome *</Label>
                <Input
                  id="fornecedor-nome"
                  value={nome}
                  onChange={(event) => setNome(event.target.value)}
                  placeholder="Ex: Atacadão, mercado, distribuidora"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fornecedor-documento">CNPJ ou CPF</Label>
                <Input
                  id="fornecedor-documento"
                  value={documento}
                  onChange={(event) => setDocumento(event.target.value)}
                  placeholder="Opcional"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fornecedor-telefone">Telefone</Label>
                  <Input
                    id="fornecedor-telefone"
                    value={telefone}
                    onChange={(event) => setTelefone(event.target.value)}
                    placeholder="(51) 99999-9999"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fornecedor-email">E-mail</Label>
                  <Input
                    id="fornecedor-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="compras@fornecedor.com"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="fornecedor-observacoes">Observações</Label>
                <Textarea
                  id="fornecedor-observacoes"
                  value={observacoes}
                  onChange={(event) => setObservacoes(event.target.value)}
                  placeholder="Condições de compra, horários, pessoa de contato..."
                />
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-border p-3">
                <Checkbox
                  id="fornecedor-ativo"
                  checked={ativo}
                  onCheckedChange={(checked) => setAtivo(Boolean(checked))}
                />
                <Label htmlFor="fornecedor-ativo" className="cursor-pointer">Fornecedor ativo</Label>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={formLoading}>
                  Cancelar
                </Button>
                <Button onClick={handleSubmit} disabled={formLoading || !nome.trim()}>
                  {formLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Salvando...
                    </>
                  ) : editingFornecedor ? 'Atualizar' : 'Cadastrar'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        <Dialog open={purchaseDialogOpen} onOpenChange={(open) => {
          setPurchaseDialogOpen(open);
          if (!open) resetPurchaseForm();
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-display text-xl">Compra avulsa</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="compra-avulsa-fornecedor">Fornecedor *</Label>
                <Select value={purchaseFornecedorId} onValueChange={setPurchaseFornecedorId}>
                  <SelectTrigger id="compra-avulsa-fornecedor">
                    <SelectValue placeholder="Selecione um fornecedor" />
                  </SelectTrigger>
                  <SelectContent side="bottom" align="start" avoidCollisions={false}>
                    {fornecedores.filter((fornecedor) => fornecedor.ativo).map((fornecedor) => (
                      <SelectItem key={fornecedor.id} value={fornecedor.id}>
                        {fornecedor.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="compra-avulsa-descricao">Descrição *</Label>
                <Input
                  id="compra-avulsa-descricao"
                  value={purchaseDescricao}
                  onChange={(event) => setPurchaseDescricao(event.target.value)}
                  placeholder="Ex: Utensilio de producao"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="compra-avulsa-categoria">Categoria</Label>
                  <Select
                    value={purchaseCategoria}
                    onValueChange={(value) => setPurchaseCategoria(value as typeof COMPRA_AVULSA_CATEGORIAS[number])}
                  >
                    <SelectTrigger id="compra-avulsa-categoria">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent side="bottom" align="start" avoidCollisions={false}>
                      {COMPRA_AVULSA_CATEGORIAS.map((categoria) => (
                        <SelectItem key={categoria} value={categoria}>{categoria}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="compra-avulsa-valor">Valor total (R$) *</Label>
                  <Input
                    id="compra-avulsa-valor"
                    type="text"
                    inputMode="decimal"
                    value={purchaseValor}
                    onChange={(event) => setPurchaseValor(event.target.value)}
                    placeholder="Ex: 24,90"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="compra-avulsa-data">Data da compra</Label>
                  <Input
                    id="compra-avulsa-data"
                    type="date"
                    value={purchaseData}
                    onChange={(event) => setPurchaseData(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="compra-avulsa-origem">Origem do pagamento</Label>
                  <Select
                    value={purchaseOrigemPagamento}
                    onValueChange={(value) => setPurchaseOrigemPagamento(value as 'fora_caixa' | 'caixa')}
                  >
                    <SelectTrigger id="compra-avulsa-origem">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent side="bottom" align="start" avoidCollisions={false}>
                      <SelectItem value="fora_caixa">Fora do caixa</SelectItem>
                      <SelectItem value="caixa">Caixa da empresa</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Fora do caixa soma no fornecedor, mas não cria despesa no Financeiro.
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="compra-avulsa-observacoes">Observações</Label>
                <Textarea
                  id="compra-avulsa-observacoes"
                  value={purchaseObservacoes}
                  onChange={(event) => setPurchaseObservacoes(event.target.value)}
                  placeholder="Detalhes da nota ou uso do item..."
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={() => setPurchaseDialogOpen(false)} disabled={purchaseFormLoading}>
                  Cancelar
                </Button>
                <Button
                  onClick={handlePurchaseSubmit}
                  disabled={
                    purchaseFormLoading
                    || !purchaseFornecedorId
                    || !purchaseDescricao.trim()
                    || !(parseDecimalInput(purchaseValor) > 0)
                  }
                >
                  {purchaseFormLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Salvando...
                    </>
                  ) : 'Registrar compra'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <section aria-labelledby="fornecedores-lista-heading" className="space-y-4">
        <h2 id="fornecedores-lista-heading" className="sr-only">Lista de fornecedores</h2>
        <div className="relative max-w-md">
          <Label htmlFor="fornecedor-busca" className="sr-only">Buscar fornecedores</Label>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
          <Input
            id="fornecedor-busca"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nome, documento, email ou telefone..."
            className="pl-10"
          />
        </div>

        {filteredFornecedores.length === 0 ? (
          <div className="text-center py-16">
            <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
              <Building2 className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="font-display font-semibold text-lg text-foreground mb-1">Nenhum fornecedor encontrado</h3>
            <p className="text-muted-foreground text-sm mb-4">
              {search ? 'Tente ajustar a busca.' : 'Cadastre seu primeiro fornecedor para organizar as compras.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredFornecedores.map((fornecedor) => {
              const purchaseSummary = summaryByFornecedorId[fornecedor.id];

              return (
                <div
                  key={fornecedor.id}
                  className={cn(
                    'bg-card border border-border rounded-lg p-5 shadow-sm transition-shadow hover:shadow-md',
                    !fornecedor.ativo && 'opacity-60',
                  )}
                >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Building2 className="w-5 h-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-foreground truncate">{fornecedor.nome}</h3>
                        {!fornecedor.ativo && (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                            Inativo
                          </span>
                        )}
                      </div>
                      {fornecedor.documento && (
                        <p className="text-xs text-muted-foreground mt-1">{fornecedor.documento}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => openEditDialog(fornecedor)}
                      className="p-2 hover:bg-muted rounded-lg transition-colors"
                      aria-label={`Editar ${fornecedor.nome}`}
                    >
                      <Edit2 size={16} className="text-muted-foreground" />
                    </button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button
                          className="p-2 hover:bg-destructive/10 rounded-lg transition-colors"
                          aria-label={`Remover ${fornecedor.nome}`}
                        >
                          <Trash2 size={16} className="text-destructive" />
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remover fornecedor?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Tem certeza que deseja remover {fornecedor.nome}? Esta ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteFornecedor(fornecedor.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Remover
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-border pt-4">
                  <div className="rounded-lg bg-muted/40 p-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <ShoppingCart size={14} />
                      Compras
                    </div>
                    <p className="mt-1 font-display text-xl font-semibold text-foreground">
                      {loadingPurchaseSummary ? '...' : formatCurrencyBRL(purchaseSummary?.totalCompras ?? 0)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {purchaseSummary?.quantidadeCompras ?? 0} lançamento(s)
                    </p>
                  </div>
                  <div className="rounded-lg bg-muted/40 p-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <CalendarDays size={14} />
                      Última compra
                    </div>
                    <p className="mt-1 font-medium text-foreground">
                      {purchaseSummary?.ultimaCompra ? formatLocalDate(purchaseSummary.ultimaCompra, 'dd/MM/yyyy') : '-'}
                    </p>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-4 w-full gap-2"
                  onClick={() => openPurchaseDialog(fornecedor)}
                  disabled={!fornecedor.ativo}
                >
                  <ShoppingCart size={16} />
                  Compra avulsa
                </Button>

                <div className="mt-4 space-y-2">
                  {fornecedor.telefone && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone size={14} />
                      <span>{fornecedor.telefone}</span>
                    </div>
                  )}
                  {fornecedor.email && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Mail size={14} />
                      <span className="truncate">{fornecedor.email}</span>
                    </div>
                  )}
                  {!fornecedor.telefone && !fornecedor.email && (
                    <p className="text-sm text-muted-foreground italic">Sem contato cadastrado</p>
                  )}
                </div>

                {fornecedor.observacoes && (
                  <p className="mt-4 border-t border-border pt-3 text-sm text-muted-foreground">
                    {fornecedor.observacoes}
                  </p>
                )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section aria-labelledby="fornecedor-historico-heading" className="bg-card border border-border rounded-lg">
        <div className="p-5 border-b border-border">
          <h2 id="fornecedor-historico-heading" className="font-display text-xl font-semibold text-foreground">
            Histórico de compras
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Entradas de estoque e compras avulsas agrupadas por fornecedor e data.
          </p>
        </div>
        <div className="divide-y divide-border">
          {loadingPurchaseHistory ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : historyGroups.length === 0 ? (
            <p className="p-5 text-sm text-muted-foreground">Nenhuma compra registrada ainda.</p>
          ) : (
            historyGroups.slice(0, 12).map((group) => (
              <div key={group.id} className="p-5">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-foreground">{group.fornecedor_nome}</h3>
                    <p className="text-sm text-muted-foreground">
                      {group.data ? formatLocalDate(group.data, 'dd/MM/yyyy') : 'Sem data de compra'}
                      {' '}• {group.quantidadeLancamentos} lançamento(s)
                    </p>
                  </div>
                  <p className="font-display text-xl font-semibold text-foreground">
                    {formatCurrencyBRL(group.total)}
                  </p>
                </div>
                <div className="mt-3 space-y-2">
                  {group.itens.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-lg bg-muted/50 px-3 py-2 text-sm"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                        <div>
                          <p className="font-medium text-foreground">{item.descricao}</p>
                          {formatPurchaseItemDetail(item) && (
                            <p className="text-xs text-muted-foreground">
                              {formatPurchaseItemDetail(item)}
                            </p>
                          )}
                        </div>
                        <p className="font-medium text-foreground">{formatCurrencyBRL(item.valor)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
