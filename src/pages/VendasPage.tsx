import { useState } from 'react';
import { Search, Eye, Archive, ArchiveRestore, Loader2, ShoppingBag, AlertTriangle, CopyPlus } from 'lucide-react';
import { PedidoHistorico } from '@/components/PedidoHistorico';
import { usePedidos, Pedido, getClienteDisplayName } from '@/hooks/usePedidos';
import { usePaginatedPedidos } from '@/hooks/usePaginatedPedidos';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { NovoPedidoForm } from '@/components/NovoPedidoForm';
import { PaginationControls } from '@/components/PaginationControls';
import {
  PEDIDO_STATUSES,
  getPedidoStatusLabel,
  getPedidoStatusBadgeClass,
  getPedidoFinanceiroStatusBadgeClass,
  getPedidoFinanceiroStatusLabel,
  isPedidoTerminal,
  calculateNextPedidoValorPago,
  CANAL_VENDA_LABELS,
  ENTREGA_LABELS,
  PAGAMENTO_LABELS,
} from '@/domain/pedidos';
import { getPedidoItemDisplayInfo } from '@/domain/pedidoItens';
import { FINANCIAL_CONTROL_START_LABEL, isFinancialControlDate, isHistoricalFinancialOrder } from '@/domain/financeiro';
import { parseDecimalInput } from '@/domain/numeros';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn, formatCurrencyBRL, formatLocalDate } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function VendasPage() {
  const { updatePedidoStatus, updatePedidoPayment, archivePedido, unarchivePedido } = usePedidos();
  const {
    pedidos: filteredPedidos, loading,
    page, setPage, totalPages, totalCount,
    showArchived, setShowArchived,
    statusFilter, setStatusFilter,
    search, setSearch,
    refetch,
    refetchFirstPage,
  } = usePaginatedPedidos();

  const [archiveReason, setArchiveReason] = useState('');
  const [archiveConfirmPedido, setArchiveConfirmPedido] = useState<Pedido | null>(null);
  const [showArchiveReasonModal, setShowArchiveReasonModal] = useState<Pedido | null>(null);
  const [paymentPedido, setPaymentPedido] = useState<Pedido | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  // Status labels/classes now come from domain helpers

  const handleArchiveClick = (pedido: Pedido) => {
    // Guardrail: if pedido is not terminal, show extra confirmation
    if (!isPedidoTerminal(pedido.status)) {
      setArchiveConfirmPedido(pedido);
    } else {
      setShowArchiveReasonModal(pedido);
    }
  };

  const proceedToArchiveReason = () => {
    if (archiveConfirmPedido) {
      setShowArchiveReasonModal(archiveConfirmPedido);
      setArchiveConfirmPedido(null);
    }
  };

  const handleArchive = async () => {
    if (!showArchiveReasonModal) return;
    await archivePedido(showArchiveReasonModal.id, archiveReason);
    setShowArchiveReasonModal(null);
    setArchiveReason('');
    refetch();
  };

  const handleArchiveAsTest = async () => {
    if (!showArchiveReasonModal) return;
    await archivePedido(showArchiveReasonModal.id, 'Pedido de teste');
    setShowArchiveReasonModal(null);
    setArchiveReason('');
    refetch();
  };

  const handleStatusChange = async (pedido: Pedido, status: Pedido['status']) => {
    const updated = await updatePedidoStatus(pedido.id, status, pedido);
    if (updated) {
      await refetch();
    }
  };

  const handleUnarchive = async (id: string) => {
    await unarchivePedido(id);
    refetch();
  };

  const parsedPaymentAmount = parseDecimalInput(paymentAmount);
  const nextValorPago = paymentPedido
    ? calculateNextPedidoValorPago(paymentPedido.valor_pago, paymentPedido.saldo_restante, parsedPaymentAmount)
    : null;
  const paymentError = paymentPedido && paymentAmount.trim()
    ? !Number.isFinite(parsedPaymentAmount) || parsedPaymentAmount <= 0
      ? 'Informe um valor maior que zero.'
      : parsedPaymentAmount > paymentPedido.saldo_restante
        ? 'O valor recebido não pode ser maior que o saldo restante.'
        : null
    : null;

  const openPaymentDialog = (pedido: Pedido) => {
    setPaymentPedido(pedido);
    setPaymentAmount('');
    setPaymentDate(format(new Date(), 'yyyy-MM-dd'));
  };

  const handleRegisterPayment = async () => {
    if (!paymentPedido || nextValorPago === null || !paymentDate) return;
    await updatePedidoPayment(paymentPedido.id, nextValorPago, paymentDate);
    setPaymentPedido(null);
    setPaymentAmount('');
    setPaymentDate(format(new Date(), 'yyyy-MM-dd'));
    refetch();
  };

  const getIsHistoricalFinancialOrder = (pedido: Pedido) => isHistoricalFinancialOrder(pedido.data_entrega);

  if (loading && filteredPedidos.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold text-foreground">Vendas</h1>
          <p className="text-muted-foreground mt-1">Gerencie seus pedidos</p>
        </div>
        <NovoPedidoForm onSuccess={refetchFirstPage} />
      </div>

      <section aria-labelledby="vendas-lista-heading" className="space-y-4">
        <h2 id="vendas-lista-heading" className="sr-only">Lista de pedidos</h2>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Label htmlFor="vendas-busca" className="sr-only">Buscar pedidos por cliente</Label>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <Input
              id="vendas-busca"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por cliente..."
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[180px]" aria-label="Filtrar pedidos por status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              {PEDIDO_STATUSES.map(s => (
                <SelectItem key={s} value={s}>{getPedidoStatusLabel(s)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Checkbox
              id="showArchived"
              checked={showArchived}
              onCheckedChange={(checked) => setShowArchived(!!checked)}
            />
            <Label htmlFor="showArchived" className="text-sm text-muted-foreground cursor-pointer">
              Mostrar arquivados
            </Label>
          </div>
        </div>

      {/* Extra confirmation modal for archiving active pedidos */}
      <Dialog open={!!archiveConfirmPedido} onOpenChange={(open) => { if (!open) setArchiveConfirmPedido(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-warning" />
              Pedido ainda em andamento
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            O pedido de <strong>{archiveConfirmPedido && getClienteDisplayName(archiveConfirmPedido)}</strong> está com status{' '}
            <strong>{archiveConfirmPedido && getPedidoStatusLabel(archiveConfirmPedido.status)}</strong>.
            Tem certeza que deseja arquivá-lo?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setArchiveConfirmPedido(null)}>Cancelar</Button>
            <Button onClick={proceedToArchiveReason}>Continuar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Archive reason modal */}
      <Dialog open={!!showArchiveReasonModal} onOpenChange={(open) => { if (!open) { setShowArchiveReasonModal(null); setArchiveReason(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Arquivar Pedido</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            O pedido de <strong>{showArchiveReasonModal && getClienteDisplayName(showArchiveReasonModal)}</strong> será arquivado. Pedidos arquivados saem das listagens principais e dos indicadores.
          </p>
          <Label htmlFor="vendas-motivo-arquivamento" className="sr-only">Motivo do arquivamento</Label>
          <Textarea
            id="vendas-motivo-arquivamento"
            placeholder="Motivo (opcional)"
            value={archiveReason}
            onChange={(e) => setArchiveReason(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowArchiveReasonModal(null); setArchiveReason(''); }}>Cancelar</Button>
            <Button variant="secondary" onClick={handleArchiveAsTest}>Arquivar como teste</Button>
            <Button onClick={handleArchive}>Arquivar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment modal */}
      <Dialog open={!!paymentPedido} onOpenChange={(open) => { if (!open) { setPaymentPedido(null); setPaymentAmount(''); setPaymentDate(format(new Date(), 'yyyy-MM-dd')); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar pagamento</DialogTitle>
          </DialogHeader>
          {paymentPedido && (
            <div className="space-y-4 py-2">
              <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm space-y-1">
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Cliente</span>
                  <span className="font-medium text-right">{getClienteDisplayName(paymentPedido)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Total</span>
                  <span>{formatCurrencyBRL(paymentPedido.valor_total)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Pago</span>
                  <span>{formatCurrencyBRL(paymentPedido.valor_pago)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Saldo</span>
                  <span className="font-medium">{formatCurrencyBRL(paymentPedido.saldo_restante)}</span>
                </div>
              </div>
              {(!isFinancialControlDate(paymentDate) || isHistoricalFinancialOrder(paymentPedido.data_entrega)) && (
                <div className="rounded-lg border border-accent bg-accent/30 p-3 text-sm text-accent-foreground">
                  Este pagamento será registrado no pedido, mas não entrará no financeiro oficial iniciado em {FINANCIAL_CONTROL_START_LABEL}.
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="pedido-pagamento-valor">Valor recebido</Label>
                <Input
                  id="pedido-pagamento-valor"
                  type="text"
                  inputMode="decimal"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="Ex: 50,00"
                  aria-invalid={Boolean(paymentError)}
                  aria-describedby={paymentError ? 'pedido-pagamento-valor-error' : undefined}
                />
                {paymentError && (
                  <p id="pedido-pagamento-valor-error" className="text-xs text-destructive">{paymentError}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="pedido-pagamento-data">Data do pagamento</Label>
                <Input
                  id="pedido-pagamento-data"
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  aria-invalid={!paymentDate}
                  aria-describedby={!paymentDate ? 'pedido-pagamento-data-error' : undefined}
                />
                {!paymentDate && (
                  <p id="pedido-pagamento-data-error" className="text-xs text-destructive">Informe a data do pagamento.</p>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setPaymentAmount(String(paymentPedido.saldo_restante.toFixed(2)))}>
                  Quitar saldo
                </Button>
                <Button onClick={handleRegisterPayment} disabled={nextValorPago === null || !paymentDate}>
                  Registrar pagamento
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

        {/* Orders Table */}
        {filteredPedidos.length === 0 ? (
          <div className="text-center py-16">
            <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
              <ShoppingBag className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="font-display font-semibold text-lg text-foreground mb-1">Nenhum pedido encontrado</h3>
            <p className="text-muted-foreground text-sm mb-4">
              {search || statusFilter !== 'todos'
                ? 'Tente ajustar os filtros de busca.'
                : 'Crie seu primeiro pedido para começar a gerenciar suas vendas.'}
            </p>
            {!search && statusFilter === 'todos' && <NovoPedidoForm onSuccess={refetchFirstPage} />}
          </div>
        ) : (
          <>
            <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-4 font-medium text-sm">Cliente</th>
                    <th className="text-left p-4 font-medium text-sm">Entrega</th>
                    <th className="text-left p-4 font-medium text-sm">Itens</th>
                    <th className="text-left p-4 font-medium text-sm">Total</th>
                    <th className="text-left p-4 font-medium text-sm">Pagamento</th>
                    <th className="text-left p-4 font-medium text-sm">Status</th>
                    <th className="text-left p-4 font-medium text-sm">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPedidos.map((pedido) => (
                    <tr key={pedido.id} className={cn(
                      "border-t border-border hover:bg-muted/30 transition-colors",
                      pedido.archived_at && "opacity-50"
                    )}>
                      <td className="p-4 font-medium">
                        {getClienteDisplayName(pedido)}
                        {pedido.archived_at && (
                          <span className="ml-2 text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">Arquivado</span>
                        )}
                        {getIsHistoricalFinancialOrder(pedido) && (
                          <span className="ml-2 text-xs bg-accent text-accent-foreground px-2 py-0.5 rounded-full">Histórico</span>
                        )}
                      </td>
                      <td className="p-4 text-muted-foreground">
                        <div className="space-y-1">
                          <p>{formatLocalDate(pedido.data_entrega, 'dd/MM/yyyy', { locale: ptBR })}</p>
                          <p className="text-xs">
                            {ENTREGA_LABELS[pedido.tipo_entrega]} • {CANAL_VENDA_LABELS[pedido.canal_venda]}
                          </p>
                          {pedido.packaging_profile_nome && (
                            <p className="text-xs text-muted-foreground">
                              Embalagem: {pedido.packaging_profile_nome}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="text-sm text-muted-foreground">
                          {pedido.itens?.reduce((acc, item) => acc + item.quantidade, 0) || 0} un.
                        </span>
                      </td>
                      <td className="p-4 font-semibold">
                        {formatCurrencyBRL(pedido.valor_total)}
                      </td>
                      <td className="p-4">
                        <div className="space-y-1">
                          <span className={cn("inline-flex rounded-full px-2 py-1 text-xs font-medium", getPedidoFinanceiroStatusBadgeClass(pedido.status_financeiro))}>
                            {getPedidoFinanceiroStatusLabel(pedido.status_financeiro)}
                          </span>
                          <p className="text-xs text-muted-foreground">{PAGAMENTO_LABELS[pedido.forma_pagamento]}</p>
                          {getIsHistoricalFinancialOrder(pedido) && (
                            <p className="text-xs text-muted-foreground">Fora do financeiro oficial</p>
                          )}
                          {pedido.saldo_restante > 0 && (
                            <p className="text-xs text-warning">Saldo: {formatCurrencyBRL(pedido.saldo_restante)}</p>
                          )}
                          {pedido.saldo_restante > 0 && !pedido.archived_at && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-xs"
                              onClick={() => openPaymentDialog(pedido)}
                            >
                              Registrar pagamento
                            </Button>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <Select
                          value={pedido.status}
                          onValueChange={(value: Pedido['status']) => handleStatusChange(pedido, value)}
                        >
                          <SelectTrigger className={cn(
                            "h-8 text-xs font-medium rounded-full px-3",
                            getPedidoStatusBadgeClass(pedido.status)
                          )} aria-label={`Status do pedido de ${getClienteDisplayName(pedido)}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PEDIDO_STATUSES.map(s => (
                              <SelectItem key={s} value={s}>{getPedidoStatusLabel(s)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1">
                          <NovoPedidoForm
                            onSuccess={refetchFirstPage}
                            pedidoModelo={pedido}
                            trigger={(
                              <button
                                type="button"
                                className="p-2 hover:bg-muted rounded-lg transition-colors"
                                title="Criar pedido recorrente"
                                aria-label={`Criar pedido recorrente com base no pedido de ${getClienteDisplayName(pedido)}`}
                              >
                                <CopyPlus size={18} className="text-muted-foreground" />
                              </button>
                            )}
                          />

                          {/* View details */}
                          <Dialog>
                            <DialogTrigger asChild>
                              <button
                                className="p-2 hover:bg-muted rounded-lg transition-colors"
                                aria-label={`Ver detalhes do pedido de ${getClienteDisplayName(pedido)}`}
                              >
                                <Eye size={18} className="text-muted-foreground" />
                              </button>
                            </DialogTrigger>
                            <DialogContent
                              className="!top-4 max-h-[calc(100vh-2rem)] max-w-3xl !translate-y-0 overflow-y-auto"
                              onOpenAutoFocus={(event) => event.preventDefault()}
                            >
                              <DialogHeader>
                                <DialogTitle className="font-display">
                                  Pedido - {getClienteDisplayName(pedido)}
                                </DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4 py-4">
                                {getIsHistoricalFinancialOrder(pedido) && (
                                  <div className="rounded-lg border border-accent bg-accent/30 p-3 text-sm text-accent-foreground">
                                    Pedido histórico: não compõe o financeiro oficial iniciado em {FINANCIAL_CONTROL_START_LABEL}.
                                  </div>
                                )}
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                  <div>
                                    <p className="text-muted-foreground">Cliente</p>
                                    <p className="font-medium">{getClienteDisplayName(pedido)}</p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground">Data de entrega/retirada</p>
                                    <p className="font-medium">
                                      {formatLocalDate(pedido.data_entrega, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground">Atendimento</p>
                                    <p className="font-medium">{ENTREGA_LABELS[pedido.tipo_entrega]}</p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground">Canal</p>
                                    <p className="font-medium">{CANAL_VENDA_LABELS[pedido.canal_venda]}</p>
                                  </div>
                                  {pedido.packaging_profile_nome && (
                                    <div className="col-span-2">
                                      <p className="text-muted-foreground">Modelo de embalagem</p>
                                      <p className="font-medium">{pedido.packaging_profile_nome}</p>
                                    </div>
                                  )}
                                  {pedido.endereco_entrega && (
                                    <div className="col-span-2">
                                      <p className="text-muted-foreground">Endereço</p>
                                      <p className="font-medium">{pedido.endereco_entrega}</p>
                                    </div>
                                  )}
                                </div>
                                {pedido.archived_at && (
                                  <div className="p-3 bg-muted/50 rounded-lg text-sm">
                                    <p className="text-muted-foreground">Arquivado em {format(new Date(pedido.archived_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                                    {pedido.archived_reason && <p className="mt-1">Motivo: {pedido.archived_reason}</p>}
                                  </div>
                                )}
                                {pedido.itens && pedido.itens.length > 0 && (
                                  <div>
                                    <p className="text-muted-foreground text-sm mb-2">Itens</p>
                                    <div className="space-y-2">
                                      {pedido.itens.map((item, index) => {
                                        const produtoLookup = {
                                          nome: item.produto_nome ?? item.brigadeiro_nome,
                                          categoria: item.produto_categoria ?? item.brigadeiro_categoria ?? null,
                                          tamanho_g: item.brigadeiro_tamanho_g ?? null,
                                        };
                                        const produtoInfo = getPedidoItemDisplayInfo(item, produtoLookup);
                                        const precoUnitario = formatCurrencyBRL(item.preco_unitario);
                                        const subtotal = formatCurrencyBRL(item.quantidade * item.preco_unitario);

                                        return (
                                          <div key={`${item.brigadeiro_id || item.brigadeiro_nome}-${index}`} className="flex justify-between items-center gap-4 p-3 bg-muted/50 rounded-lg">
                                            <div className="min-w-0">
                                              <div className="flex flex-wrap items-center gap-2">
                                                <p className="font-medium">{produtoInfo.nomeBase}</p>
                                                {produtoInfo.detalhe && (
                                                  <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
                                                    {produtoInfo.detalhe}
                                                  </span>
                                                )}
                                              </div>
                                              <p className="text-sm text-muted-foreground">
                                                {item.quantidade} x {precoUnitario}
                                              </p>
                                            </div>
                                            <p className="shrink-0 font-semibold">
                                              {subtotal}
                                            </p>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                                <div className="pt-4 border-t border-border flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                  <div className="space-y-1">
                                    <span className="font-medium">Pagamento</span>
                                    <p className="text-sm text-muted-foreground">
                                      Pago: {formatCurrencyBRL(pedido.valor_pago)}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                      Saldo: {formatCurrencyBRL(pedido.saldo_restante)}
                                    </p>
                                    {pedido.saldo_restante > 0 && !pedido.archived_at && (
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        className="mt-2"
                                        onClick={() => openPaymentDialog(pedido)}
                                      >
                                        Registrar pagamento
                                      </Button>
                                    )}
                                  </div>
                                  <div className="text-right">
                                    <p className="text-sm text-muted-foreground">Total</p>
                                    <span className="text-2xl font-display font-semibold text-primary">
                                      {formatCurrencyBRL(pedido.valor_total)}
                                    </span>
                                  </div>
                                </div>
                                {/* Audit History */}
                                <div className="pt-4 border-t border-border">
                                  <PedidoHistorico pedidoId={pedido.id} />
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>

                          {/* Archive / Unarchive */}
                          {pedido.archived_at ? (
                            <button
                              className="p-2 hover:bg-muted rounded-lg transition-colors"
                              onClick={() => handleUnarchive(pedido.id)}
                              title="Desarquivar"
                              aria-label={`Desarquivar pedido de ${getClienteDisplayName(pedido)}`}
                            >
                              <ArchiveRestore size={18} className="text-muted-foreground" />
                            </button>
                          ) : (
                            <button
                              className="p-2 hover:bg-muted rounded-lg transition-colors"
                              onClick={() => handleArchiveClick(pedido)}
                              title="Arquivar"
                              aria-label={`Arquivar pedido de ${getClienteDisplayName(pedido)}`}
                            >
                              <Archive size={18} className="text-muted-foreground" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </div>
            <PaginationControls page={page} totalPages={totalPages} totalCount={totalCount} onPageChange={setPage} />
          </>
        )}
      </section>
    </div>
  );
}
