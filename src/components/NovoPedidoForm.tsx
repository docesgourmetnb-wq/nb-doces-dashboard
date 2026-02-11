import { useState } from 'react';
import { Plus, Trash2, Loader2, UserPlus, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useBrigadeiros } from '@/hooks/useBrigadeiros';
import { useClientes } from '@/hooks/useClientes';
import { usePedidos, ItemPedido, Pedido } from '@/hooks/usePedidos';
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
import { cn } from '@/lib/utils';

interface NovoPedidoFormProps {
  onSuccess?: () => void;
}

export function NovoPedidoForm({ onSuccess }: NovoPedidoFormProps) {
  const { brigadeiros } = useBrigadeiros();
  const { clientes } = useClientes();
  const { addPedido } = usePedidos();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [clienteId, setClienteId] = useState('');
  const [clienteNovo, setClienteNovo] = useState('');
  const [modoCliente, setModoCliente] = useState<'existente' | 'novo'>('existente');
  const [dataPedido, setDataPedido] = useState<Date>(new Date());
  const [tipoPedido, setTipoPedido] = useState<Pedido['tipo_pedido']>('encomenda');
  const [formaPagamento, setFormaPagamento] = useState<Pedido['forma_pagamento']>('pix');
  const [observacoes, setObservacoes] = useState('');
  const [itens, setItens] = useState<ItemPedido[]>([]);
  
  // For adding new item
  const [selectedBrigadeiro, setSelectedBrigadeiro] = useState('');
  const [quantidade, setQuantidade] = useState(1);

  const valorTotal = itens.reduce((acc, item) => acc + (item.quantidade * item.preco_unitario), 0);

  const clienteNome = modoCliente === 'existente' 
    ? clientes.find(c => c.id === clienteId)?.nome || ''
    : clienteNovo.trim();

  const handleAddItem = () => {
    if (!selectedBrigadeiro || quantidade <= 0) return;
    
    const brigadeiro = brigadeiros.find(b => b.id === selectedBrigadeiro);
    if (!brigadeiro) return;

    // Check if already exists
    const existingIndex = itens.findIndex(i => i.brigadeiro_id === selectedBrigadeiro);
    if (existingIndex >= 0) {
      const updated = [...itens];
      updated[existingIndex].quantidade += quantidade;
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
    if (!clienteNome || itens.length === 0) return;
    
    setLoading(true);
    try {
      await addPedido({
        cliente: clienteNome,
        data: format(dataPedido, 'yyyy-MM-dd'),
        tipo_pedido: tipoPedido,
        valor_total: valorTotal,
        forma_pagamento: formaPagamento,
        status: 'pendente',
        observacoes: observacoes.trim() || null,
      }, itens);
      
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
    setModoCliente('existente');
    setDataPedido(new Date());
    setTipoPedido('encomenda');
    setFormaPagamento('pix');
    setObservacoes('');
    setItens([]);
    setSelectedBrigadeiro('');
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
              <Label>Cliente *</Label>
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
                <SelectTrigger>
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
              <Input
                value={clienteNovo}
                onChange={(e) => setClienteNovo(e.target.value)}
                placeholder="Nome do novo cliente"
              />
            )}
          </div>

          {/* Order Date */}
          <div className="space-y-2">
            <Label>Data do Pedido</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !dataPedido && "text-muted-foreground"
                  )}
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
          <div className="space-y-2">
            <Label>Tipo de Pedido</Label>
            <Select value={tipoPedido} onValueChange={(v: Pedido['tipo_pedido']) => setTipoPedido(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="encomenda">Encomenda</SelectItem>
                <SelectItem value="pronta-entrega">Pronta Entrega</SelectItem>
                <SelectItem value="evento">Evento</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Add Items */}
          <div className="space-y-4">
            <Label>Adicionar Itens *</Label>
            <div className="flex flex-col sm:flex-row gap-3">
              <Select value={selectedBrigadeiro} onValueChange={setSelectedBrigadeiro}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Selecione um produto" />
                </SelectTrigger>
                <SelectContent>
                  {brigadeiros.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.nome} - R$ {b.preco_venda.toFixed(2)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="number"
                min={1}
                value={quantidade}
                onChange={(e) => setQuantidade(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-24"
                placeholder="Qtd"
              />
              <Button type="button" variant="secondary" onClick={handleAddItem} disabled={!selectedBrigadeiro}>
                <Plus size={18} />
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
          <div className="space-y-2">
            <Label>Forma de Pagamento</Label>
            <Select value={formaPagamento} onValueChange={(v: Pedido['forma_pagamento']) => setFormaPagamento(v)}>
              <SelectTrigger>
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
              disabled={loading || !clienteNome || itens.length === 0}
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
