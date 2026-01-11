import { useState } from 'react';
import { Plus, Calendar } from 'lucide-react';
import { producaoDiaria as initialProducao, brigadeiros } from '@/data/mockData';
import { ProducaoDiaria } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function ProducaoPage() {
  const [producao, setProducao] = useState<ProducaoDiaria[]>(initialProducao);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    data: format(new Date(), 'yyyy-MM-dd'),
    brigadeiroId: '',
    quantidade: '',
  });

  const statusLabels = {
    'planejado': { label: 'Planejado', class: 'bg-muted text-muted-foreground' },
    'em-andamento': { label: 'Em Andamento', class: 'bg-info/20 text-info' },
    'concluido': { label: 'Concluído', class: 'bg-success/20 text-success' },
  };

  const totalCustoHoje = producao
    .filter(p => format(p.data, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd'))
    .reduce((acc, p) => acc + p.custoTotal, 0);

  const totalUnidadesHoje = producao
    .filter(p => format(p.data, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd'))
    .reduce((acc, p) => acc + p.quantidade, 0);

  const handleAddProducao = () => {
    const brigadeiro = brigadeiros.find(b => b.id === formData.brigadeiroId);
    if (!brigadeiro) return;

    const quantidade = parseInt(formData.quantidade);
    const custoTotal = quantidade * brigadeiro.custoUnitario;

    const novaProducao: ProducaoDiaria = {
      id: Date.now().toString(),
      data: new Date(formData.data),
      brigadeiroId: brigadeiro.id,
      brigadeiroNome: brigadeiro.nome,
      quantidade,
      custoTotal,
      status: 'planejado',
    };

    setProducao([...producao, novaProducao]);
    setIsDialogOpen(false);
    setFormData({ data: format(new Date(), 'yyyy-MM-dd'), brigadeiroId: '', quantidade: '' });
  };

  const updateStatus = (id: string, status: ProducaoDiaria['status']) => {
    setProducao(producao.map(p => p.id === id ? { ...p, status } : p));
  };

  // Group by date
  const producaoByDate = producao.reduce((acc, item) => {
    const dateKey = format(item.data, 'yyyy-MM-dd');
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(item);
    return acc;
  }, {} as Record<string, ProducaoDiaria[]>);

  const sortedDates = Object.keys(producaoByDate).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold text-foreground">Produção</h1>
          <p className="text-muted-foreground mt-1">Planejamento e controle de produção</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus size={18} />
              Planejar Produção
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-display">Nova Produção</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Data</Label>
                <Input
                  type="date"
                  value={formData.data}
                  onChange={(e) => setFormData({ ...formData, data: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Sabor</Label>
                <Select
                  value={formData.brigadeiroId}
                  onValueChange={(value) => setFormData({ ...formData, brigadeiroId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o sabor" />
                  </SelectTrigger>
                  <SelectContent>
                    {brigadeiros.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Quantidade</Label>
                <Input
                  type="number"
                  value={formData.quantidade}
                  onChange={(e) => setFormData({ ...formData, quantidade: e.target.value })}
                  placeholder="Ex: 50"
                />
              </div>
              {formData.brigadeiroId && formData.quantidade && (
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm font-medium">
                    Custo estimado: R$ {(
                      parseInt(formData.quantidade) * 
                      (brigadeiros.find(b => b.id === formData.brigadeiroId)?.custoUnitario || 0)
                    ).toFixed(2)}
                  </p>
                </div>
              )}
              <Button onClick={handleAddProducao} className="w-full">
                Adicionar à Produção
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">Produção de Hoje</p>
          <p className="text-3xl font-display font-semibold mt-1">{totalUnidadesHoje} un.</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">Custo Total Hoje</p>
          <p className="text-3xl font-display font-semibold mt-1">
            R$ {totalCustoHoje.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Production Timeline */}
      <div className="space-y-6">
        {sortedDates.map((dateKey) => (
          <div key={dateKey} className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
            <div className="bg-muted/50 px-5 py-3 flex items-center gap-2 border-b border-border">
              <Calendar size={18} className="text-muted-foreground" />
              <h3 className="font-display font-semibold">
                {format(new Date(dateKey), "EEEE, dd 'de' MMMM", { locale: ptBR })}
              </h3>
            </div>
            <div className="divide-y divide-border">
              {producaoByDate[dateKey].map((item) => (
                <div key={item.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex-1">
                    <h4 className="font-medium">{item.brigadeiroNome}</h4>
                    <p className="text-sm text-muted-foreground">
                      {item.quantidade} unidades • Custo: R$ {item.custoTotal.toFixed(2)}
                    </p>
                  </div>
                  <Select
                    value={item.status}
                    onValueChange={(value: ProducaoDiaria['status']) => updateStatus(item.id, value)}
                  >
                    <SelectTrigger className={cn(
                      "w-full sm:w-[160px] text-sm font-medium border-0",
                      statusLabels[item.status].class
                    )}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="planejado">Planejado</SelectItem>
                      <SelectItem value="em-andamento">Em Andamento</SelectItem>
                      <SelectItem value="concluido">Concluído</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
