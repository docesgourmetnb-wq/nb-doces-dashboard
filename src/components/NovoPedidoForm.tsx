import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Loader2, UserPlus, Calendar, CopyPlus } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useBrigadeiros } from '@/hooks/useBrigadeiros';
import { type ProdutoCatalogoVariacao, useProdutosCatalogo } from '@/hooks/useProdutosCatalogo';
import { useClientes } from '@/hooks/useClientes';
import { usePedidos, ItemPedido, Pedido, getClienteDisplayName } from '@/hooks/usePedidos';
import { usePackagingProfiles } from '@/hooks/usePackagingProfiles';
import {
  CANAIS_VENDA,
  CANAL_VENDA_LABELS,
  ENTREGA_LABELS,
  ENTREGA_TIPOS,
  canCreateHistoricalOrderAsDelivered,
  deriveInitialPedidoStatus,
  derivePedidoFinanceiroStatus,
  type CanalVenda,
  type EntregaTipo,
} from '@/domain/pedidos';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { findClienteByContato } from '@/domain/clientes';
import { buildPedidoRecorrenteFromModelo } from '@/domain/pedidoModelos';
import { getPedidoItemDisplayInfo, getPedidoItemDisplayLabel } from '@/domain/pedidoItens';
import { summarizePackagingProfileItems } from '@/domain/embalagens';
import { FINANCIAL_CONTROL_START_LABEL, isHistoricalOrder } from '@/domain/financeiro';
import {
  BRIGADEIRO_TAMANHO_FILTERS,
  type BrigadeiroTamanhoFilter,
  filterProdutosBrigadeiro,
  getProdutoNomeComercial,
  getProdutoTamanhoComercial,
  matchesBrigadeiroTamanhoFilter,
  type ProdutoCategoria,
} from '@/domain/produtos';
import { parseDecimalInput, parseIntegerInput } from '@/domain/numeros';
import { cn, formatCurrencyBRL } from '@/lib/utils';

interface NovoPedidoFormProps {
  onSuccess?: () => void | Promise<void>;
  pedidoModelo?: Pedido;
  trigger?: ReactNode;
}

function getTamanhoSortValue(tamanho: string | null) {
  return Number(tamanho?.replace(',', '.').replace(/g$/i, '') ?? Number.POSITIVE_INFINITY);
}

const PEDIDO_PRODUTO_CATEGORIAS: Array<{ value: ProdutoCategoria; label: string }> = [
  { value: 'brigadeiro', label: 'Brigadeiros' },
  { value: 'bolo', label: 'Bolos' },
];

interface PedidoProdutoOption {
  key: string;
  categoria: ProdutoCategoria;
  nome: string;
  nomeOriginal: string;
  detalhe: string | null;
  preco: number;
  brigadeiroId?: string | null;
  produtoId?: string | null;
  produtoVariacaoId?: string | null;
}

function getBoloVariacaoLabel(variacao: ProdutoCatalogoVariacao) {
  return [variacao.tamanho, variacao.cobertura]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(' • ') || variacao.nome;
}

function getPedidoItemKey(item: Pick<ItemPedido, 'brigadeiro_id' | 'produto_variacao_id' | 'brigadeiro_nome'>) {
  if (item.produto_variacao_id) return `variacao:${item.produto_variacao_id}`;
  if (item.brigadeiro_id) return `brigadeiro:${item.brigadeiro_id}`;
  return `manual:${item.brigadeiro_nome.toLowerCase().trim()}`;
}

function formatLocalDateForInput(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function NovoPedidoForm({ onSuccess, pedidoModelo, trigger }: NovoPedidoFormProps) {
  const { brigadeiros } = useBrigadeiros();
  const { produtos: produtosCatalogo } = useProdutosCatalogo();
  const { clientes, addCliente } = useClientes();
  const { addPedido } = usePedidos();
  const { profiles: packagingProfiles, loading: packagingProfilesLoading } = usePackagingProfiles();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [clienteId, setClienteId] = useState('');
  const [clienteNovo, setClienteNovo] = useState('');
  const [clienteNovoTelefone, setClienteNovoTelefone] = useState('');
  const [clienteNovoEmail, setClienteNovoEmail] = useState('');
  const [modoCliente, setModoCliente] = useState<'existente' | 'novo'>('existente');
  const [dataPedido, setDataPedido] = useState<Date>(new Date());
  const [tipoPedido, setTipoPedido] = useState<Pedido['tipo_pedido']>('encomenda');
  const [tipoEntrega, setTipoEntrega] = useState<EntregaTipo>('retirada');
  const [enderecoEntrega, setEnderecoEntrega] = useState('');
  const [canalVenda, setCanalVenda] = useState<CanalVenda>('whatsapp');
  const [formaPagamento, setFormaPagamento] = useState<Pedido['forma_pagamento']>('pix');
  const [packagingProfileId, setPackagingProfileId] = useState('none');
  const [historicalDelivered, setHistoricalDelivered] = useState(false);
  const [valorPago, setValorPago] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [itens, setItens] = useState<ItemPedido[]>([]);
  
  // For adding new item
  const [selectedBrigadeiro, setSelectedBrigadeiro] = useState('');
  const [categoriaProduto, setCategoriaProduto] = useState<ProdutoCategoria>('brigadeiro');
  const [tamanhoProdutoFilter, setTamanhoProdutoFilter] = useState<BrigadeiroTamanhoFilter>('todos');
  const [quantidade, setQuantidade] = useState(1);
  const isPedidoRecorrente = Boolean(pedidoModelo);
  const dataEntrega = formatLocalDateForInput(dataPedido);
  const isPedidoHistorico = isHistoricalOrder({ data_entrega: dataEntrega });
  const produtosBrigadeiro = useMemo(() => filterProdutosBrigadeiro(brigadeiros), [brigadeiros]);

  const produtosBolo = useMemo(() => {
    return produtosCatalogo
      .filter((produto) => produto.categoria_codigo === 'bolo')
      .flatMap((produto) => produto.variacoes.map<PedidoProdutoOption>((variacao) => ({
        key: `variacao:${variacao.id}`,
        categoria: 'bolo',
        nome: produto.nome,
        nomeOriginal: `${produto.nome} • ${getBoloVariacaoLabel(variacao)}`,
        detalhe: getBoloVariacaoLabel(variacao),
        preco: variacao.preco_venda,
        brigadeiroId: variacao.brigadeiro_id,
        produtoId: produto.id,
        produtoVariacaoId: variacao.id,
      })))
      .sort((a, b) => {
        const nomeCompare = a.nome.localeCompare(b.nome, 'pt-BR');
        if (nomeCompare !== 0) return nomeCompare;
        return (a.detalhe ?? '').localeCompare(b.detalhe ?? '', 'pt-BR');
      });
  }, [produtosCatalogo]);

  const produtosDisponiveis = useMemo(() => {
    if (categoriaProduto === 'bolo') return produtosBolo;

    return produtosBrigadeiro
      .filter((brigadeiro) => matchesBrigadeiroTamanhoFilter(brigadeiro, tamanhoProdutoFilter))
      .sort((a, b) => {
        const nomeBaseCompare = getProdutoNomeComercial(a).localeCompare(getProdutoNomeComercial(b), 'pt-BR');
        if (nomeBaseCompare !== 0) return nomeBaseCompare;
        return getTamanhoSortValue(getProdutoTamanhoComercial(a)) - getTamanhoSortValue(getProdutoTamanhoComercial(b));
      })
      .map<PedidoProdutoOption>((brigadeiro) => ({
        key: `brigadeiro:${brigadeiro.id}`,
        categoria: 'brigadeiro',
        nome: getProdutoNomeComercial(brigadeiro),
        nomeOriginal: brigadeiro.nome,
        detalhe: getProdutoTamanhoComercial(brigadeiro),
        preco: brigadeiro.preco_venda,
        brigadeiroId: brigadeiro.id,
        produtoId: brigadeiro.produto_id ?? null,
        produtoVariacaoId: brigadeiro.produto_variacao_id ?? null,
      }));
  }, [categoriaProduto, produtosBolo, produtosBrigadeiro, tamanhoProdutoFilter]);

  const produtosPorId = useMemo(() => {
    return new Map(produtosBrigadeiro.map((produto) => [produto.id, produto]));
  }, [produtosBrigadeiro]);
  const selectedPackagingProfile = packagingProfileId !== 'none'
    ? packagingProfiles.find((profile) => profile.id === packagingProfileId) ?? null
    : null;
  const selectedPackagingSummary = selectedPackagingProfile
    ? summarizePackagingProfileItems(selectedPackagingProfile.items)
    : null;

  useEffect(() => {
    if (isPedidoHistorico && packagingProfileId !== 'none') {
      setPackagingProfileId('none');
    }
  }, [isPedidoHistorico, packagingProfileId]);

  useEffect(() => {
    if (!isPedidoHistorico && historicalDelivered) {
      setHistoricalDelivered(false);
    }
  }, [historicalDelivered, isPedidoHistorico]);

  const selectedProdutoData = produtosDisponiveis.find((produto) => produto.key === selectedBrigadeiro) || null;
  const itemPendente: ItemPedido | null = selectedProdutoData && quantidade > 0
    ? {
        brigadeiro_id: selectedProdutoData.brigadeiroId ?? null,
        brigadeiro_nome: selectedProdutoData.nomeOriginal,
        brigadeiro_categoria: selectedProdutoData.categoria,
        produto_id: selectedProdutoData.produtoId ?? null,
        produto_variacao_id: selectedProdutoData.produtoVariacaoId ?? null,
        produto_categoria: selectedProdutoData.categoria,
        produto_nome: selectedProdutoData.nome,
        produto_variacao_nome: selectedProdutoData.detalhe,
        quantidade,
        preco_unitario: selectedProdutoData.preco,
      }
    : null;
  const itensDoPedido = itemPendente ? (() => {
    const updated = [...itens];
    const existingIndex = updated.findIndex(item => getPedidoItemKey(item) === getPedidoItemKey(itemPendente));

    if (existingIndex >= 0) {
      const existingItem = updated[existingIndex];
      if (!existingItem) return updated;
      updated[existingIndex] = {
        ...existingItem,
        quantidade: existingItem.quantidade + itemPendente.quantidade,
      };
      return updated;
    }

    return [...updated, itemPendente];
  })() : itens;
  const valorTotal = itensDoPedido.reduce((acc, item) => acc + (item.quantidade * item.preco_unitario), 0);
  const valorPagoNumber = valorPago.trim() === '' ? 0 : parseDecimalInput(valorPago);
  const valorPagoEhNumero = Number.isFinite(valorPagoNumber);
  const valorPagoValido = valorPagoEhNumero && valorPagoNumber >= 0 && valorPagoNumber <= valorTotal;
  const valorPagoError = !valorPagoEhNumero || valorPagoNumber < 0
    ? 'Informe um valor válido. Use 0, 4,00 ou 4.00.'
    : valorPagoNumber > valorTotal
      ? 'O valor pago não pode ser maior que o total do pedido.'
      : null;
  const statusFinanceiro = valorPagoValido ? derivePedidoFinanceiroStatus(valorTotal, valorPagoNumber) : 'nao_pago';
  const canMarkHistoricalDelivered = canCreateHistoricalOrderAsDelivered({
    isHistoricalOrder: isPedidoHistorico,
    valorTotal,
    valorPago: valorPagoValido ? valorPagoNumber : 0,
  });
  const historicalDeliveredValido = !historicalDelivered || canMarkHistoricalDelivered;
  const enderecoEntregaValido = tipoEntrega !== 'entrega' || enderecoEntrega.trim().length > 0;

  const clienteNome = modoCliente === 'existente' 
    ? clientes.find(c => c.id === clienteId)?.nome || ''
    : clienteNovo.trim();
  const canSubmit = Boolean(clienteNome) && itensDoPedido.length > 0 && valorPagoValido && enderecoEntregaValido && historicalDeliveredValido;

  const applyPedidoModelo = () => {
    if (!pedidoModelo) return;

    const clienteModelo = pedidoModelo.cliente_id
      ? clientes.find((cliente) => cliente.id === pedidoModelo.cliente_id)
      : clientes.find((cliente) => cliente.nome.toLowerCase() === getClienteDisplayName(pedidoModelo).toLowerCase());

    if (clienteModelo) {
      setModoCliente('existente');
      setClienteId(clienteModelo.id);
      setClienteNovo('');
    } else {
      setModoCliente('novo');
      setClienteId('');
      setClienteNovo(getClienteDisplayName(pedidoModelo));
    }

    setClienteNovoTelefone('');
    setClienteNovoEmail('');
    const recorrente = buildPedidoRecorrenteFromModelo(pedidoModelo);

    setDataPedido(new Date());
    setTipoPedido(recorrente.tipo_pedido);
    setTipoEntrega(recorrente.tipo_entrega);
    setEnderecoEntrega(recorrente.endereco_entrega);
    setCanalVenda(recorrente.canal_venda);
    setFormaPagamento(recorrente.forma_pagamento);
    setPackagingProfileId(recorrente.packaging_profile_id || 'none');
    setHistoricalDelivered(false);
    setValorPago(recorrente.valor_pago);
    setObservacoes(recorrente.observacoes);
    setItens(recorrente.itens);
    setSelectedBrigadeiro('');
    setCategoriaProduto('brigadeiro');
    setTamanhoProdutoFilter('todos');
    setQuantidade(1);
  };

  const handleAddItem = () => {
    if (!selectedBrigadeiro || quantidade <= 0) return;
    
    const produto = produtosDisponiveis.find((option) => option.key === selectedBrigadeiro);
    if (!produto) return;

    // Check if already exists
    const newItem: ItemPedido = {
      brigadeiro_id: produto.brigadeiroId ?? null,
      brigadeiro_nome: produto.nomeOriginal,
      brigadeiro_categoria: produto.categoria,
      produto_id: produto.produtoId ?? null,
      produto_variacao_id: produto.produtoVariacaoId ?? null,
      produto_categoria: produto.categoria,
      produto_nome: produto.nome,
      produto_variacao_nome: produto.detalhe,
      quantidade,
      preco_unitario: produto.preco,
    };
    const existingIndex = itens.findIndex(i => getPedidoItemKey(i) === getPedidoItemKey(newItem));
    if (existingIndex >= 0) {
      const updated = [...itens];
      const existingItem = updated[existingIndex];
      if (!existingItem) return;
      existingItem.quantidade += quantidade;
      setItens(updated);
    } else {
      setItens([...itens, newItem]);
    }
    
    setSelectedBrigadeiro('');
    setQuantidade(1);
  };

  const handleRemoveItem = (index: number) => {
    setItens(itens.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    
    setLoading(true);
    try {
      const dataCriacao = format(new Date(), 'yyyy-MM-dd');
      const statusOperacionalInicial = deriveInitialPedidoStatus({
        isHistoricalOrder: isPedidoHistorico,
        markHistoricalAsDelivered: historicalDelivered,
        valorTotal,
        valorPago: valorPagoNumber,
      });
      let pedidoClienteId = modoCliente === 'existente' && clienteId ? clienteId : null;
      let pedidoClienteNome = clienteNome;

      if (modoCliente === 'novo') {
        const clienteExistente = findClienteByContato(clientes, {
          email: clienteNovoEmail,
          telefone: clienteNovoTelefone,
        });

        if (clienteExistente) {
          pedidoClienteId = clienteExistente.id;
          pedidoClienteNome = clienteExistente.nome;
        } else {
          const novoCliente = await addCliente({
            nome: clienteNome,
            email: clienteNovoEmail.trim() || null,
            telefone: clienteNovoTelefone.trim() || null,
          });
          if (!novoCliente) return;
          pedidoClienteId = novoCliente.id;
          pedidoClienteNome = novoCliente.nome;
        }
      }

      const novoPedido = await addPedido({
        cliente: pedidoClienteNome,
        cliente_id: pedidoClienteId,
        data: dataCriacao,
        data_entrega: dataEntrega,
        tipo_pedido: tipoPedido,
        tipo_entrega: tipoEntrega,
        endereco_entrega: tipoEntrega === 'entrega' ? enderecoEntrega.trim() : null,
        canal_venda: canalVenda,
        valor_total: valorTotal,
        valor_pago: valorPagoNumber,
        saldo_restante: Math.max(valorTotal - valorPagoNumber, 0),
        forma_pagamento: formaPagamento,
        status: statusOperacionalInicial,
        status_operacional: statusOperacionalInicial,
        status_financeiro: statusFinanceiro,
        packaging_profile_id: isPedidoHistorico || packagingProfileId === 'none' ? null : packagingProfileId,
        packaging_profile_nome: isPedidoHistorico ? null : selectedPackagingProfile?.nome ?? null,
        observacoes: observacoes.trim() || null,
      }, itensDoPedido);
      if (!novoPedido) return;
      
      // Reset form
      resetForm();
      setOpen(false);
      await onSuccess?.();
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setClienteId('');
    setClienteNovo('');
    setClienteNovoTelefone('');
    setClienteNovoEmail('');
    setModoCliente('existente');
    setDataPedido(new Date());
    setTipoPedido('encomenda');
    setTipoEntrega('retirada');
    setEnderecoEntrega('');
    setCanalVenda('whatsapp');
    setFormaPagamento('pix');
    setPackagingProfileId('none');
    setHistoricalDelivered(false);
    setValorPago('');
    setObservacoes('');
    setItens([]);
    setSelectedBrigadeiro('');
    setCategoriaProduto('brigadeiro');
    setTamanhoProdutoFilter('todos');
    setQuantidade(1);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (isOpen && pedidoModelo) {
        applyPedidoModelo();
      }
      setOpen(isOpen);
      if (!isOpen) resetForm();
    }}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button className="gap-2">
            <Plus size={18} />
            Novo Pedido
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            {isPedidoRecorrente ? 'Pedido recorrente' : 'Novo Pedido'}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {isPedidoRecorrente && pedidoModelo && (
            <div className="rounded-lg border border-accent bg-accent/30 p-3 text-sm text-accent-foreground">
              <div className="flex gap-2">
                <CopyPlus className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="space-y-1">
                  <p className="font-medium">Baseado no pedido de {getClienteDisplayName(pedidoModelo)}</p>
                  <p>
                    Itens, atendimento e embalagem foram reaproveitados. A data é nova e o pagamento começa em branco.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Client Selection */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor={modoCliente === 'existente' ? 'pedido-cliente' : 'pedido-cliente-novo'}>Cliente *</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setModoCliente(modoCliente === 'existente' ? 'novo' : 'existente')}
                className="text-xs gap-1.5"
              >
                <UserPlus size={14} />
                {modoCliente === 'existente' ? 'Novo cliente' : 'Cliente cadastrado'}
              </Button>
            </div>
            
            {modoCliente === 'existente' ? (
              <Select value={clienteId} onValueChange={setClienteId}>
                <SelectTrigger id="pedido-cliente">
                  <SelectValue placeholder="Selecione um cliente cadastrado" />
                </SelectTrigger>
                <SelectContent>
                  {clientes.length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground text-center">
                      Nenhum cliente cadastrado
                    </div>
                  ) : (
                    clientes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        <span>{c.nome}</span>
                        {c.telefone && (
                          <span className="text-muted-foreground ml-2">• {c.telefone}</span>
                        )}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2 sm:col-span-2">
                  <Input
                    id="pedido-cliente-novo"
                    value={clienteNovo}
                    onChange={(e) => setClienteNovo(e.target.value)}
                    placeholder="Nome do novo cliente"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pedido-cliente-novo-telefone">Telefone</Label>
                  <Input
                    id="pedido-cliente-novo-telefone"
                    value={clienteNovoTelefone}
                    onChange={(e) => setClienteNovoTelefone(e.target.value)}
                    placeholder="WhatsApp ou telefone"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pedido-cliente-novo-email">E-mail</Label>
                  <Input
                    id="pedido-cliente-novo-email"
                    type="email"
                    value={clienteNovoEmail}
                    onChange={(e) => setClienteNovoEmail(e.target.value)}
                    placeholder="email@exemplo.com"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Delivery Date */}
          <div className="space-y-2">
            <Label htmlFor="pedido-data">Data de Entrega/Retirada</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="pedido-data"
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !dataPedido && "text-muted-foreground"
                  )}
                  aria-label={`Selecionar data do pedido: ${format(dataPedido, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}`}
                  aria-haspopup="dialog"
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  {format(dataPedido, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 z-50" align="start">
                <CalendarComponent
                  mode="single"
                  selected={dataPedido}
                  onSelect={(date) => date && setDataPedido(date)}
                  initialFocus
                  locale={ptBR}
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
            {isPedidoHistorico && (
              <div className="space-y-3 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
                <p>
                  Pedido histórico: datas anteriores a {FINANCIAL_CONTROL_START_LABEL} ficam apenas no registro comercial. Não entra na operação atual, não reserva estoque e não usa modelo de embalagem.
                </p>
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="pedido-historico-entregue"
                    checked={historicalDelivered}
                    onCheckedChange={(checked) => setHistoricalDelivered(checked === true)}
                    aria-describedby="pedido-historico-entregue-help"
                  />
                  <div className="space-y-1">
                    <Label
                      htmlFor="pedido-historico-entregue"
                      className="cursor-pointer text-sm font-medium text-warning"
                    >
                      Registrar histórico como entregue
                    </Label>
                    <p id="pedido-historico-entregue-help" className="text-xs text-warning/80">
                      Use para pedidos antigos já finalizados. Disponível apenas quando o valor pago cobre o total.
                    </p>
                    {historicalDelivered && !canMarkHistoricalDelivered && (
                      <p className="text-xs font-medium text-destructive">
                        Para salvar como entregue, informe o pagamento total do pedido.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Order Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="pedido-tipo">Tipo de Pedido</Label>
              <Select value={tipoPedido} onValueChange={(v: Pedido['tipo_pedido']) => setTipoPedido(v)}>
                <SelectTrigger id="pedido-tipo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="encomenda">Encomenda</SelectItem>
                  <SelectItem value="pronta-entrega">Pronta Entrega</SelectItem>
                  <SelectItem value="evento">Evento</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pedido-canal-venda">Canal de Venda</Label>
              <Select value={canalVenda} onValueChange={(v: CanalVenda) => setCanalVenda(v)}>
                <SelectTrigger id="pedido-canal-venda">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CANAIS_VENDA.map((canal) => (
                    <SelectItem key={canal} value={canal}>{CANAL_VENDA_LABELS[canal]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Fulfillment */}
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="pedido-tipo-entrega">Atendimento</Label>
              <Select value={tipoEntrega} onValueChange={(v: EntregaTipo) => setTipoEntrega(v)}>
                <SelectTrigger id="pedido-tipo-entrega">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ENTREGA_TIPOS.map((tipo) => (
                    <SelectItem key={tipo} value={tipo}>{ENTREGA_LABELS[tipo]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {tipoEntrega === 'entrega' && (
              <div className="space-y-2">
                <Label htmlFor="pedido-endereco-entrega">Endereço de entrega *</Label>
                <Input
                  id="pedido-endereco-entrega"
                  value={enderecoEntrega}
                  onChange={(e) => setEnderecoEntrega(e.target.value)}
                  placeholder="Endereço completo para entrega"
                  aria-invalid={!enderecoEntregaValido}
                  aria-describedby={!enderecoEntregaValido ? 'pedido-endereco-entrega-error' : undefined}
                />
                {!enderecoEntregaValido && (
                  <p id="pedido-endereco-entrega-error" className="text-xs text-destructive">Informe o endereço para entrega.</p>
                )}
              </div>
            )}
          </div>

          {/* Packaging Profile */}
          <div className="space-y-2">
            <Label htmlFor="pedido-modelo-embalagem">Modelo de embalagem</Label>
            <Select value={packagingProfileId} onValueChange={setPackagingProfileId} disabled={isPedidoHistorico}>
              <SelectTrigger id="pedido-modelo-embalagem" disabled={isPedidoHistorico}>
                <SelectValue placeholder="Selecione um modelo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem modelo definido</SelectItem>
                {packagingProfilesLoading ? (
                  <div className="p-2 text-sm text-muted-foreground text-center">
                    Carregando modelos...
                  </div>
                ) : packagingProfiles.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground text-center">
                    Nenhum modelo cadastrado
                  </div>
                ) : (
                  packagingProfiles.map((profile) => (
                    <SelectItem key={profile.id} value={profile.id}>
                      {profile.nome}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {isPedidoHistorico ? (
              <p className="text-xs text-muted-foreground">
                Indisponível para pedidos históricos. O pedido será registrado sem vínculo operacional de embalagem.
              </p>
            ) : selectedPackagingProfile ? (
              <div className="space-y-1 text-xs text-muted-foreground">
                <p>
                  {selectedPackagingSummary?.itemsCount ?? 0} item(ns) vinculados
                  {selectedPackagingSummary && selectedPackagingSummary.knownCost > 0
                    ? ` • custo conhecido estimado: ${formatCurrencyBRL(selectedPackagingSummary.knownCost)}`
                    : ' • custo conhecido estimado: R$ 0,00'}
                </p>
                <p>
                  {selectedPackagingSummary?.itemsWithoutKnownCost
                    ? 'Há itens sem custo informado. '
                    : ''}
                  O estoque não será baixado automaticamente.
                </p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Opcional. Use para registrar o padrão de embalagem usado neste pedido.
              </p>
            )}
          </div>

          {/* Add Items */}
          <div className="space-y-4">
            <Label htmlFor="pedido-produto">Adicionar Itens *</Label>
            <div className="flex w-full sm:w-fit rounded-lg border border-border bg-muted/40 p-1">
              {PEDIDO_PRODUTO_CATEGORIAS.map((categoria) => (
                <Button
                  key={categoria.value}
                  type="button"
                  size="sm"
                  variant={categoriaProduto === categoria.value ? 'default' : 'ghost'}
                  className="flex-1 sm:flex-none px-4"
                  onClick={() => {
                    setCategoriaProduto(categoria.value);
                    setSelectedBrigadeiro('');
                  }}
                >
                  {categoria.label}
                </Button>
              ))}
            </div>
            {categoriaProduto === 'brigadeiro' && (
              <div className="flex w-full sm:w-fit rounded-lg border border-border bg-muted/40 p-1">
                {BRIGADEIRO_TAMANHO_FILTERS.map((filter) => (
                  <Button
                    key={filter.value}
                    type="button"
                    size="sm"
                    variant={tamanhoProdutoFilter === filter.value ? 'default' : 'ghost'}
                    className="flex-1 sm:flex-none px-4"
                    onClick={() => {
                      setTamanhoProdutoFilter(filter.value);
                      setSelectedBrigadeiro('');
                    }}
                  >
                    {filter.label}
                  </Button>
                ))}
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-3">
              <Select value={selectedBrigadeiro} onValueChange={setSelectedBrigadeiro}>
                <SelectTrigger id="pedido-produto" className="flex-1">
                  <SelectValue placeholder="Selecione um produto" />
                </SelectTrigger>
                <SelectContent>
                  {produtosDisponiveis.length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground text-center">
                      {categoriaProduto === 'bolo' ? 'Nenhuma variação de bolo disponível' : 'Nenhum produto nesse tamanho'}
                    </div>
                  ) : (
                    produtosDisponiveis.map((produto) => {
                      const label = produto.detalhe && (categoriaProduto === 'bolo' || tamanhoProdutoFilter === 'todos')
                        ? `${produto.nome} • ${produto.detalhe}`
                        : produto.nome;

                      return (
                        <SelectItem key={produto.key} value={produto.key}>
                          {label}
                        </SelectItem>
                      );
                    })
                  )}
                </SelectContent>
              </Select>
              <Input
                id="pedido-quantidade"
                aria-label="Quantidade do produto"
                type="number"
                min={1}
                step={1}
                value={quantidade}
                onChange={(e) => {
                  const parsedQuantidade = parseIntegerInput(e.target.value);
                  setQuantidade(Number.isFinite(parsedQuantidade) && parsedQuantidade > 0 ? parsedQuantidade : 1);
                }}
                className="w-24"
                placeholder="Qtd"
              />
              <Button type="button" variant="secondary" onClick={handleAddItem} disabled={!selectedBrigadeiro} className="gap-2" aria-label="Adicionar item ao pedido">
                <Plus size={18} />
                <span className="hidden sm:inline">Adicionar</span>
              </Button>
            </div>

            {/* Items List */}
            {itens.length > 0 && (
              <div className="space-y-2 border border-border rounded-lg p-4 bg-muted/30">
                {itens.map((item, index) => {
                  const produtoLookup = item.brigadeiro_id ? produtosPorId.get(item.brigadeiro_id) : null;
                  const produtoInfo = getPedidoItemDisplayInfo(item, produtoLookup);
                  const itemLabel = getPedidoItemDisplayLabel(produtoInfo);

                  return (
                    <div key={index} className="flex items-center justify-between p-3 bg-card rounded-lg border border-border">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{produtoInfo.nomeBase}</p>
                          {produtoInfo.detalhe && (
                            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                              {produtoInfo.detalhe}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {item.quantidade} x {formatCurrencyBRL(item.preco_unitario)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <p className="font-semibold">
                          {formatCurrencyBRL(item.quantidade * item.preco_unitario)}
                        </p>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(index)}
                          className="p-1.5 text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                          aria-label={`Remover ${itemLabel} do pedido`}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}
                <div className="flex justify-between items-center pt-3 border-t border-border mt-3">
                  <span className="font-medium">Total do Pedido</span>
                  <span className="text-xl font-display font-semibold text-primary">
                    {formatCurrencyBRL(valorTotal)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Payment */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="pedido-forma-pagamento">Forma de Pagamento</Label>
              <Select value={formaPagamento} onValueChange={(v: Pedido['forma_pagamento']) => setFormaPagamento(v)}>
                <SelectTrigger id="pedido-forma-pagamento">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="cartao">Cartão</SelectItem>
                  <SelectItem value="dinheiro">Dinheiro</SelectItem>
                  <SelectItem value="transferencia">Transferência</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pedido-valor-pago">Valor pago</Label>
              <Input
                id="pedido-valor-pago"
                type="text"
                inputMode="decimal"
                value={valorPago}
                onChange={(e) => setValorPago(e.target.value)}
                placeholder={valorTotal > 0 ? `Opcional. Sugestão: ${formatCurrencyBRL(valorTotal / 2)}` : 'Opcional'}
                aria-invalid={Boolean(valorPagoError)}
                aria-describedby={valorPagoError ? 'pedido-valor-pago-error' : 'pedido-valor-pago-help'}
              />
              {valorPagoError ? (
                <p id="pedido-valor-pago-error" className="text-xs text-destructive">{valorPagoError}</p>
              ) : (
                <p id="pedido-valor-pago-help" className="text-xs text-muted-foreground">Deixe em branco se ainda não houve pagamento.</p>
              )}
            </div>
            <div className="sm:col-span-2 rounded-lg border border-border bg-muted/30 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Saldo restante</span>
                <span className="font-medium">{formatCurrencyBRL(Math.max(valorTotal - (valorPagoValido ? valorPagoNumber : 0), 0))}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Observações sobre o pedido..."
              rows={3}
            />
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={loading || !canSubmit}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Criar Pedido'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
