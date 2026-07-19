import { useMemo, useState } from 'react';
import { Plus, Trash2, Loader2, UserPlus, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useBrigadeiros } from '@/hooks/useBrigadeiros';
import { useClientes } from '@/hooks/useClientes';
import { usePedidos, ItemPedido, Pedido } from '@/hooks/usePedidos';
import {
  CANAIS_VENDA,
  CANAL_VENDA_LABELS,
  ENTREGA_LABELS,
  ENTREGA_TIPOS,
  derivePedidoFinanceiroStatus,
  type CanalVenda,
  type EntregaTipo,
} from '@/domain/pedidos';
import { Button } from '@/components/ui/button';
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
import { getProdutoNomeBase, getProdutoTamanho } from '@/domain/produtos';
import { cn } from '@/lib/utils';

interface NovoPedidoFormProps {
  onSuccess?: () => void;
}

type TamanhoProdutoFilter = 'todos' | '25g' | '30g';

const tamanhoProdutoFilters: Array<{ value: TamanhoProdutoFilter; label: string }> = [
  { value: 'todos', label: 'Todos' },
  { value: '25g', label: '25g' },
  { value: '30g', label: '30g' },
];

function getTamanhoSortValue(tamanho: string | null) {
  return Number(tamanho?.replace(',', '.').replace(/g$/i, '') ?? Number.POSITIVE_INFINITY);
}

export function NovoPedidoForm({ onSuccess }: NovoPedidoFormProps) {
  const { brigadeiros } = useBrigadeiros();
  const { clientes, addCliente } = useClientes();
  const { addPedido } = usePedidos();
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
  const [valorPago, setValorPago] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [itens, setItens] = useState<ItemPedido[]>([]);
  
  // For adding new item
  const [selectedBrigadeiro, setSelectedBrigadeiro] = useState('');
  const [tamanhoProdutoFilter, setTamanhoProdutoFilter] = useState<TamanhoProdutoFilter>('todos');
  const [quantidade, setQuantidade] = useState(1);

  const produtosDisponiveis = useMemo(() => {
    return brigadeiros
      .filter((brigadeiro) => {
        const tamanho = getProdutoTamanho(brigadeiro.nome);
        return tamanhoProdutoFilter === 'todos' || tamanho === tamanhoProdutoFilter;
      })
      .sort((a, b) => {
        const nomeBaseCompare = getProdutoNomeBase(a.nome).localeCompare(getProdutoNomeBase(b.nome), 'pt-BR');
        if (nomeBaseCompare !== 0) return nomeBaseCompare;
        return getTamanhoSortValue(getProdutoTamanho(a.nome)) - getTamanhoSortValue(getProdutoTamanho(b.nome));
      });
  }, [brigadeiros, tamanhoProdutoFilter]);

  const selectedBrigadeiroData = brigadeiros.find(b => b.id === selectedBrigadeiro) || null;
  const itemPendente: ItemPedido | null = selectedBrigadeiroData && quantidade > 0
    ? {
        brigadeiro_id: selectedBrigadeiroData.id,
        brigadeiro_nome: selectedBrigadeiroData.nome,
        quantidade,
        preco_unitario: selectedBrigadeiroData.preco_venda,
      }
    : null;
  const itensDoPedido = itemPendente ? (() => {
    const updated = [...itens];
    const existingIndex = updated.findIndex(item => item.brigadeiro_id === itemPendente.brigadeiro_id);

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
  const valorPagoNormalizado = valorPago.trim().replace(',', '.');
  const valorPagoNumber = valorPagoNormalizado === '' ? 0 : Number(valorPagoNormalizado);
  const valorPagoEhNumero = Number.isFinite(valorPagoNumber);
  const valorPagoValido = valorPagoEhNumero && valorPagoNumber >= 0 && valorPagoNumber <= valorTotal;
  const valorPagoError = !valorPagoEhNumero || valorPagoNumber < 0
    ? 'Informe um valor válido. Use 0, 4,00 ou 4.00.'
    : valorPagoNumber > valorTotal
      ? 'O valor pago não pode ser maior que o total do pedido.'
      : null;
  const enderecoEntregaValido = tipoEntrega !== 'entrega' || enderecoEntrega.trim().length > 0;

  const clienteNome = modoCliente === 'existente' 
    ? clientes.find(c => c.id === clienteId)?.nome || ''
    : clienteNovo.trim();
  const canSubmit = Boolean(clienteNome) && itensDoPedido.length > 0 && valorPagoValido && enderecoEntregaValido;

  const handleAddItem = () => {
    if (!selectedBrigadeiro || quantidade <= 0) return;
    
    const brigadeiro = brigadeiros.find(b => b.id === selectedBrigadeiro);
    if (!brigadeiro) return;

    // Check if already exists
    const existingIndex = itens.findIndex(i => i.brigadeiro_id === selectedBrigadeiro);
    if (existingIndex >= 0) {
      const updated = [...itens];
      const existingItem = updated[existingIndex];
      if (!existingItem) return;
      existingItem.quantidade += quantidade;
      setItens(updated);
    } else {
      setItens([...itens, {
        brigadeiro_id: brigadeiro.id,
        brigadeiro_nome: brigadeiro.nome,
        quantidade,
        preco_unitario: brigadeiro.preco_venda,
      }]);
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
      const dataEntrega = `${dataPedido.getFullYear()}-${String(dataPedido.getMonth() + 1).padStart(2, '0')}-${String(dataPedido.getDate()).padStart(2, '0')}`;
      const statusFinanceiro = derivePedidoFinanceiroStatus(valorTotal, valorPagoNumber);
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
        data: dataEntrega,
        data_entrega: dataEntrega,
        tipo_pedido: tipoPedido,
        tipo_entrega: tipoEntrega,
        endereco_entrega: tipoEntrega === 'entrega' ? enderecoEntrega.trim() : null,
        canal_venda: canalVenda,
        valor_total: valorTotal,
        valor_pago: valorPagoNumber,
        saldo_restante: Math.max(valorTotal - valorPagoNumber, 0),
        forma_pagamento: formaPagamento,
        status: valorPagoNumber > 0 ? 'confirmado' : 'orcamento',
        status_operacional: valorPagoNumber > 0 ? 'confirmado' : 'orcamento',
        status_financeiro: statusFinanceiro,
        observacoes: observacoes.trim() || null,
      }, itensDoPedido);
      if (!novoPedido) return;
      
      // Reset form
      resetForm();
      setOpen(false);
      onSuccess?.();
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
    setValorPago('');
    setObservacoes('');
    setItens([]);
    setSelectedBrigadeiro('');
    setTamanhoProdutoFilter('todos');
    setQuantidade(1);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen) resetForm();
    }}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus size={18} />
          Novo Pedido
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Novo Pedido</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
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

          {/* Add Items */}
          <div className="space-y-4">
            <Label htmlFor="pedido-produto">Adicionar Itens *</Label>
            <div className="flex w-full sm:w-fit rounded-lg border border-border bg-muted/40 p-1">
              {tamanhoProdutoFilters.map((filter) => (
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
            <div className="flex flex-col sm:flex-row gap-3">
              <Select value={selectedBrigadeiro} onValueChange={setSelectedBrigadeiro}>
                <SelectTrigger id="pedido-produto" className="flex-1">
                  <SelectValue placeholder="Selecione um produto" />
                </SelectTrigger>
                <SelectContent>
                  {produtosDisponiveis.length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground text-center">
                      Nenhum produto nesse tamanho
                    </div>
                  ) : (
                    produtosDisponiveis.map((b) => {
                      const tamanho = getProdutoTamanho(b.nome);
                      const nomeBase = getProdutoNomeBase(b.nome);
                      const label = tamanho
                        ? `${nomeBase} • ${tamanho} • R$ ${b.preco_venda.toFixed(2)}`
                        : `${b.nome} • R$ ${b.preco_venda.toFixed(2)}`;

                      return (
                        <SelectItem key={b.id} value={b.id}>
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
                value={quantidade}
                onChange={(e) => setQuantidade(Math.max(1, parseInt(e.target.value) || 1))}
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
                {itens.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-card rounded-lg border border-border">
                    <div className="flex-1">
                      <p className="font-medium">{item.brigadeiro_nome}</p>
                      <p className="text-sm text-muted-foreground">
                        {item.quantidade} x R$ {item.preco_unitario.toFixed(2)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="font-semibold">
                        R$ {(item.quantidade * item.preco_unitario).toFixed(2)}
                      </p>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(index)}
                        className="p-1.5 text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                        aria-label={`Remover ${item.brigadeiro_nome} do pedido`}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
                <div className="flex justify-between items-center pt-3 border-t border-border mt-3">
                  <span className="font-medium">Total do Pedido</span>
                  <span className="text-xl font-display font-semibold text-primary">
                    R$ {valorTotal.toFixed(2)}
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
                placeholder={valorTotal > 0 ? `Opcional. Sugestão: R$ ${(valorTotal / 2).toFixed(2)}` : 'Opcional'}
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
                <span className="font-medium">R$ {Math.max(valorTotal - (valorPagoValido ? valorPagoNumber : 0), 0).toFixed(2)}</span>
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
