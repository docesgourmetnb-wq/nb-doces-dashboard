import { useState } from 'react';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AlertTriangle, Package, Scale, Loader2, Trash2, Edit2, Eye } from 'lucide-react';
import { useMassasCongeladas, MassaComPesoCalculado } from '@/hooks/useMassasCongeladas';
import { useBrigadeiros } from '@/hooks/useBrigadeiros';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
} from '@/components/ui/dialog';

const statusLabels = {
  congelado: 'Congelado',
  em_uso: 'Em Uso',
  consumido: 'Consumido',
};

const statusColors = {
  congelado: 'bg-blue-100 text-blue-800',
  em_uso: 'bg-amber-100 text-amber-800',
  consumido: 'bg-gray-100 text-gray-800',
};

export function EstoqueMassasTab() {
  const { 
    massas, 
    loading, 
    updateMassa, 
    deleteMassa,
    estoqueAtual, 
    totalPesoEstoque,
    massasProximasValidade 
  } = useMassasCongeladas();
  const { brigadeiros, loading: loadingBrigadeiros } = useBrigadeiros();

  const brigadeirosAtivos = brigadeiros.filter(b => b.ativo);
  const tiposUnicos = [...new Set(massas.map(m => m.tipo_massa))];
  const tiposBrigadeiros = brigadeirosAtivos.map(b => b.nome);
  const tiposExtras = tiposUnicos.filter(t => !tiposBrigadeiros.includes(t));
  const tiposParaFiltro = [...tiposBrigadeiros, ...tiposExtras];

  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterTipo, setFilterTipo] = useState<string>('all');
  const [selectedMassa, setSelectedMassa] = useState<MassaComPesoCalculado | null>(null);

  const filteredMassas = massas.filter(m => {
    if (filterStatus !== 'all' && m.status !== filterStatus) return false;
    if (filterTipo !== 'all' && m.tipo_massa !== filterTipo) return false;
    return true;
  });

  const getValidadeBadge = (validade: string, status: string) => {
    if (status === 'consumido') return null;
    
    const dias = differenceInDays(new Date(validade), new Date());
    
    if (dias < 0) {
      return <Badge variant="destructive">Vencida</Badge>;
    } else if (dias <= 7) {
      return <Badge className="bg-amber-100 text-amber-800">Vence em {dias}d</Badge>;
    }
    return null;
  };

  const handleStatusChange = async (id: string, newStatus: 'congelado' | 'em_uso' | 'consumido') => {
    await updateMassa(id, { status: newStatus });
  };

  const handleDelete = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir este registro?')) {
      await deleteMassa(id);
    }
  };

  if (loading || loadingBrigadeiros) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Scale className="h-4 w-4" />
              Estoque Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalPesoEstoque.toFixed(0)}g</p>
            <p className="text-sm text-muted-foreground">
              {estoqueAtual.length} prato(s) com massa
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Package className="h-4 w-4" />
              Por Tipo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 text-sm">
              {tiposParaFiltro.map(tipo => {
                const total = estoqueAtual
                  .filter(m => m.tipo_massa === tipo)
                  .reduce((sum, m) => sum + m.peso_massa, 0);
                if (total === 0) return null;

                const isExtra = tiposExtras.includes(tipo);

                return (
                  <p key={tipo}>
                    {tipo}{isExtra ? ' (não cadastrado)' : ''}: <strong>{total.toFixed(0)}g</strong>
                  </p>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className={massasProximasValidade.length > 0 ? 'border-amber-300' : ''}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Alertas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {massasProximasValidade.length > 0 ? (
              <div>
                <p className="text-xl font-bold text-amber-600">
                  {massasProximasValidade.length}
                </p>
                <p className="text-sm text-muted-foreground">
                  massa(s) vencendo em 7 dias
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nenhum alerta de validade
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Status:</span>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="congelado">Congelado</SelectItem>
              <SelectItem value="em_uso">Em Uso</SelectItem>
              <SelectItem value="consumido">Consumido</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Tipo:</span>
          <Select value={filterTipo} onValueChange={setFilterTipo}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {tiposParaFiltro.map(tipo => {
                const isExtra = tiposExtras.includes(tipo);
                return (
                  <SelectItem key={tipo} value={tipo}>
                    {tipo}{isExtra ? ' (não cadastrado)' : ''}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* List */}
      {filteredMassas.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              {massas.length === 0 
                ? 'Nenhuma massa congelada registrada ainda.'
                : 'Nenhuma massa encontrada com os filtros selecionados.'
              }
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredMassas.map(massa => (
            <Card key={massa.id} className="overflow-hidden">
              {massa.foto_url && (
                <div className="aspect-video bg-muted">
                  <img
                    src={massa.foto_url}
                    alt="Foto da massa"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-semibold text-lg">
                      {massa.recipiente?.codigo || 'Prato'}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {massa.tipo_massa}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge className={statusColors[massa.status]}>
                      {statusLabels[massa.status]}
                    </Badge>
                    {getValidadeBadge(massa.validade, massa.status)}
                  </div>
                </div>

                <div className="space-y-1 text-sm mb-4">
                  <p>
                    <span className="text-muted-foreground">Peso da massa:</span>{' '}
                    <strong className="text-lg">{massa.peso_massa.toFixed(0)}g</strong>
                  </p>
                  <p>
                    <span className="text-muted-foreground">Produção:</span>{' '}
                    {format(new Date(massa.data_producao), "dd/MM/yyyy", { locale: ptBR })}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Validade:</span>{' '}
                    {format(new Date(massa.validade), "dd/MM/yyyy", { locale: ptBR })}
                  </p>
                </div>

                {/* Status Change */}
                {massa.status !== 'consumido' && (
                  <div className="mb-3">
                    <Select
                      value={massa.status}
                      onValueChange={(value: 'congelado' | 'em_uso' | 'consumido') =>
                        handleStatusChange(massa.id, value)
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="congelado">Congelado</SelectItem>
                        <SelectItem value="em_uso">Em Uso</SelectItem>
                        <SelectItem value="consumido">Consumido</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => setSelectedMassa(massa)}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    Detalhes
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleDelete(massa.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selectedMassa} onOpenChange={() => setSelectedMassa(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detalhes da Massa</DialogTitle>
          </DialogHeader>
          {selectedMassa && (
            <div className="space-y-4">
              {selectedMassa.foto_url && (
                <img
                  src={selectedMassa.foto_url}
                  alt="Foto da massa"
                  className="w-full rounded-lg"
                />
              )}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Recipiente</p>
                  <p className="font-medium">{selectedMassa.recipiente?.codigo}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Tipo de Massa</p>
                  <p className="font-medium">{selectedMassa.tipo_massa}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Peso Total (prato+massa)</p>
                  <p className="font-medium">{selectedMassa.peso_total}g</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Peso do Prato</p>
                  <p className="font-medium">{selectedMassa.recipiente?.peso_vazio}g</p>
                </div>
                <div className="col-span-2">
                  <p className="text-muted-foreground">Peso da Massa (calculado)</p>
                  <p className="font-bold text-xl text-primary">{selectedMassa.peso_massa.toFixed(0)}g</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Produção</p>
                  <p className="font-medium">
                    {format(new Date(selectedMassa.data_producao), "dd/MM/yyyy", { locale: ptBR })}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Congelamento</p>
                  <p className="font-medium">
                    {format(new Date(selectedMassa.data_congelamento), "dd/MM/yyyy", { locale: ptBR })}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Validade</p>
                  <p className="font-medium">
                    {format(new Date(selectedMassa.validade), "dd/MM/yyyy", { locale: ptBR })}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <Badge className={statusColors[selectedMassa.status]}>
                    {statusLabels[selectedMassa.status]}
                  </Badge>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
