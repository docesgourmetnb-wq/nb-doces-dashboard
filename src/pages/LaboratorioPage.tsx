import { useMemo, useState } from 'react';
import { Beaker, Lightbulb, MessageSquareText, Pencil, Plus, Search, Trash2, Loader2 } from 'lucide-react';
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
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  LaboratorioCanal,
  LaboratorioItem,
  LaboratorioPrioridade,
  LaboratorioStatus,
  LaboratorioTipo,
  useLaboratorioItems,
} from '@/hooks/useLaboratorioItems';
import { cn } from '@/lib/utils';

const tipoOptions: Array<{ value: LaboratorioTipo; label: string; icon: typeof Lightbulb }> = [
  { value: 'ideia', label: 'Ideia', icon: Lightbulb },
  { value: 'teste', label: 'Teste', icon: Beaker },
  { value: 'feedback', label: 'Feedback', icon: MessageSquareText },
];

const statusOptions: Array<{ value: LaboratorioStatus; label: string }> = [
  { value: 'ideia', label: 'Ideia' },
  { value: 'em_teste', label: 'Em teste' },
  { value: 'aprovado', label: 'Aprovado' },
  { value: 'descartado', label: 'Descartado' },
  { value: 'acao_gerada', label: 'Ação gerada' },
];

const prioridadeOptions: Array<{ value: LaboratorioPrioridade; label: string }> = [
  { value: 'baixa', label: 'Baixa' },
  { value: 'media', label: 'Média' },
  { value: 'alta', label: 'Alta' },
];

const canalOptions: Array<{ value: LaboratorioCanal; label: string }> = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'presencial', label: 'Presencial' },
  { value: 'outro', label: 'Outro' },
];

const tipoLabels = Object.fromEntries(tipoOptions.map((option) => [option.value, option.label])) as Record<LaboratorioTipo, string>;
const statusLabels = Object.fromEntries(statusOptions.map((option) => [option.value, option.label])) as Record<LaboratorioStatus, string>;
const prioridadeLabels = Object.fromEntries(prioridadeOptions.map((option) => [option.value, option.label])) as Record<LaboratorioPrioridade, string>;
const canalLabels = Object.fromEntries(canalOptions.map((option) => [option.value, option.label])) as Record<LaboratorioCanal, string>;

type TipoFilter = LaboratorioTipo | 'todos';
type StatusFilter = LaboratorioStatus | 'todos';

interface LaboratorioFormData {
  tipo: LaboratorioTipo;
  titulo: string;
  descricao: string;
  status: LaboratorioStatus;
  prioridade: LaboratorioPrioridade;
  cliente: string;
  produto_relacionado: string;
  canal: LaboratorioCanal | 'nenhum';
  data_registro: string;
}

function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

function getInitialFormData(tipo: LaboratorioTipo = 'ideia'): LaboratorioFormData {
  return {
    tipo,
    titulo: '',
    descricao: '',
    status: tipo === 'teste' ? 'em_teste' : tipo === 'feedback' ? 'acao_gerada' : 'ideia',
    prioridade: 'media',
    cliente: '',
    produto_relacionado: '',
    canal: 'nenhum',
    data_registro: getTodayDate(),
  };
}

function getStatusClass(status: LaboratorioStatus) {
  if (status === 'aprovado') return 'bg-success/10 text-success';
  if (status === 'em_teste') return 'bg-accent/20 text-accent';
  if (status === 'descartado') return 'bg-muted text-muted-foreground';
  if (status === 'acao_gerada') return 'bg-primary/10 text-primary';
  return 'bg-secondary text-secondary-foreground';
}

function getPrioridadeClass(prioridade: LaboratorioPrioridade) {
  if (prioridade === 'alta') return 'text-destructive';
  if (prioridade === 'baixa') return 'text-muted-foreground';
  return 'text-accent';
}

function formatDateBR(date: string) {
  const [year, month, day] = date.split('-');
  return `${day}/${month}/${year}`;
}

export function LaboratorioPage() {
  const { items, loading, addItem, updateItem, deleteItem } = useLaboratorioItems();
  const [search, setSearch] = useState('');
  const [tipoFilter, setTipoFilter] = useState<TipoFilter>('todos');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('todos');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<LaboratorioItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<LaboratorioFormData>(getInitialFormData());
  const [titleError, setTitleError] = useState('');

  const resumo = useMemo(() => ({
    ideias: items.filter((item) => item.tipo === 'ideia').length,
    testes: items.filter((item) => item.tipo === 'teste').length,
    feedbacks: items.filter((item) => item.tipo === 'feedback').length,
    aprovados: items.filter((item) => item.status === 'aprovado').length,
  }), [items]);

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchesSearch = !term || [
        item.titulo,
        item.descricao,
        item.cliente,
        item.produto_relacionado,
      ].some((value) => value?.toLowerCase().includes(term));
      const matchesTipo = tipoFilter === 'todos' || item.tipo === tipoFilter;
      const matchesStatus = statusFilter === 'todos' || item.status === statusFilter;
      return matchesSearch && matchesTipo && matchesStatus;
    });
  }, [items, search, statusFilter, tipoFilter]);

  const openNewDialog = (tipo: LaboratorioTipo = 'ideia') => {
    setEditingItem(null);
    setFormData(getInitialFormData(tipo));
    setTitleError('');
    setIsDialogOpen(true);
  };

  const openEditDialog = (item: LaboratorioItem) => {
    setEditingItem(item);
    setFormData({
      tipo: item.tipo,
      titulo: item.titulo,
      descricao: item.descricao || '',
      status: item.status,
      prioridade: item.prioridade,
      cliente: item.cliente || '',
      produto_relacionado: item.produto_relacionado || '',
      canal: item.canal || 'nenhum',
      data_registro: item.data_registro,
    });
    setTitleError('');
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.titulo.trim()) {
      setTitleError('Informe um título para o registro');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        tipo: formData.tipo,
        titulo: formData.titulo.trim(),
        descricao: formData.descricao.trim() || null,
        status: formData.status,
        prioridade: formData.prioridade,
        cliente: formData.cliente.trim() || null,
        produto_relacionado: formData.produto_relacionado.trim() || null,
        canal: formData.canal === 'nenhum' ? null : formData.canal,
        data_registro: formData.data_registro,
      };

      const saved = editingItem
        ? await updateItem(editingItem.id, payload)
        : await addItem(payload);

      if (saved) setIsDialogOpen(false);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-foreground">Laboratório</h1>
          <p className="mt-1 text-muted-foreground">Ideias, testes e feedbacks antes de virar produto oficial</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => openNewDialog()} className="gap-2">
              <Plus size={18} />
              Novo registro
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle className="font-display">
                {editingItem ? 'Editar registro' : 'Novo registro no laboratório'}
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="laboratorio-tipo">Tipo</Label>
                  <Select value={formData.tipo} onValueChange={(value: LaboratorioTipo) => setFormData({ ...formData, tipo: value })}>
                    <SelectTrigger id="laboratorio-tipo"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {tipoOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="laboratorio-data">Data</Label>
                  <Input
                    id="laboratorio-data"
                    type="date"
                    value={formData.data_registro}
                    onChange={(event) => setFormData({ ...formData, data_registro: event.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="laboratorio-titulo">Título</Label>
                <Input
                  id="laboratorio-titulo"
                  value={formData.titulo}
                  onChange={(event) => {
                    setFormData({ ...formData, titulo: event.target.value });
                    if (titleError) setTitleError('');
                  }}
                  placeholder="Ex: Brigadeiro de maracujá com chocolate branco"
                  aria-invalid={!!titleError}
                  aria-describedby={titleError ? 'laboratorio-titulo-error' : undefined}
                />
                {titleError && <p id="laboratorio-titulo-error" className="text-xs text-destructive">{titleError}</p>}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="laboratorio-status">Status</Label>
                  <Select value={formData.status} onValueChange={(value: LaboratorioStatus) => setFormData({ ...formData, status: value })}>
                    <SelectTrigger id="laboratorio-status"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="laboratorio-prioridade">Prioridade</Label>
                  <Select value={formData.prioridade} onValueChange={(value: LaboratorioPrioridade) => setFormData({ ...formData, prioridade: value })}>
                    <SelectTrigger id="laboratorio-prioridade"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {prioridadeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="laboratorio-cliente">Cliente</Label>
                  <Input
                    id="laboratorio-cliente"
                    value={formData.cliente}
                    onChange={(event) => setFormData({ ...formData, cliente: event.target.value })}
                    placeholder="Opcional"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="laboratorio-produto">Produto</Label>
                  <Input
                    id="laboratorio-produto"
                    value={formData.produto_relacionado}
                    onChange={(event) => setFormData({ ...formData, produto_relacionado: event.target.value })}
                    placeholder="Opcional"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="laboratorio-canal">Canal</Label>
                  <Select value={formData.canal} onValueChange={(value: LaboratorioCanal | 'nenhum') => setFormData({ ...formData, canal: value })}>
                    <SelectTrigger id="laboratorio-canal"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nenhum">Não informado</SelectItem>
                      {canalOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="laboratorio-descricao">Anotações</Label>
                <Textarea
                  id="laboratorio-descricao"
                  value={formData.descricao}
                  onChange={(event) => setFormData({ ...formData, descricao: event.target.value })}
                  placeholder="Detalhes do sabor, teste, comentário do cliente ou próximo passo..."
                  rows={4}
                />
              </div>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {editingItem ? 'Salvar alterações' : 'Salvar registro'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        {tipoOptions.map((option) => {
          const Icon = option.icon;
          const value = option.value === 'ideia' ? resumo.ideias : option.value === 'teste' ? resumo.testes : resumo.feedbacks;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setTipoFilter(option.value)}
              className={cn(
                'rounded-lg border border-border bg-card p-4 text-left shadow-sm transition-colors hover:border-primary/40',
                tipoFilter === option.value && 'border-primary bg-primary/5',
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground">{option.label}s</p>
                  <p className="mt-2 font-display text-3xl font-semibold text-foreground">{value}</p>
                </div>
                <div className="rounded-xl bg-primary/10 p-3 text-primary">
                  <Icon size={21} aria-hidden="true" />
                </div>
              </div>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setStatusFilter('aprovado')}
          className={cn(
            'rounded-lg border border-border bg-card p-4 text-left shadow-sm transition-colors hover:border-success/40',
            statusFilter === 'aprovado' && 'border-success bg-success/5',
          )}
        >
          <p className="text-xs font-semibold uppercase text-muted-foreground">Aprovados</p>
          <p className="mt-2 font-display text-3xl font-semibold text-foreground">{resumo.aprovados}</p>
        </button>
      </div>

      <section className="space-y-4" aria-labelledby="laboratorio-lista-heading">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <h2 id="laboratorio-lista-heading" className="font-display text-xl font-semibold">Registros</h2>
          <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-[1fr_180px_180px_auto] lg:max-w-4xl">
            <div className="relative">
              <Label htmlFor="laboratorio-busca" className="sr-only">Buscar registros</Label>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
              <Input
                id="laboratorio-busca"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar no laboratório..."
                className="pl-10"
              />
            </div>
            <Select value={tipoFilter} onValueChange={(value: TipoFilter) => setTipoFilter(value)}>
              <SelectTrigger aria-label="Filtrar por tipo"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os tipos</SelectItem>
                {tipoOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(value: StatusFilter) => setStatusFilter(value)}>
              <SelectTrigger aria-label="Filtrar por status"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                {statusOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(search || tipoFilter !== 'todos' || statusFilter !== 'todos') && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSearch('');
                  setTipoFilter('todos');
                  setStatusFilter('todos');
                }}
              >
                Limpar
              </Button>
            )}
          </div>
        </div>

        {filteredItems.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-card/60 py-16 text-center">
            <Lightbulb className="mx-auto h-10 w-10 text-muted-foreground" />
            <h3 className="mt-4 font-display text-lg font-semibold">Nenhum registro encontrado</h3>
            <p className="mt-1 text-sm text-muted-foreground">Guarde ideias, testes e feedbacks para decidir o que vira produto.</p>
            <Button className="mt-4 gap-2" onClick={() => openNewDialog()}>
              <Plus size={16} />
              Criar primeiro registro
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {filteredItems.map((item) => {
              const tipo = tipoOptions.find((option) => option.value === item.tipo) ?? tipoOptions[0]!;
              const Icon = tipo.icon;
              return (
                <article key={item.id} className="rounded-lg border border-border bg-card p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                          <Icon size={13} aria-hidden="true" />
                          {tipoLabels[item.tipo]}
                        </span>
                        <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', getStatusClass(item.status))}>
                          {statusLabels[item.status]}
                        </span>
                        <span className={cn('text-xs font-semibold', getPrioridadeClass(item.prioridade))}>
                          {prioridadeLabels[item.prioridade]}
                        </span>
                      </div>
                      <h3 className="mt-3 font-display text-lg font-semibold leading-tight">{item.titulo}</h3>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        onClick={() => openEditDialog(item)}
                        className="rounded-md p-1.5 transition-colors hover:bg-muted"
                        aria-label={`Editar ${item.titulo}`}
                      >
                        <Pencil size={16} className="text-muted-foreground" />
                      </button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <button
                            type="button"
                            className="rounded-md p-1.5 transition-colors hover:bg-destructive/10"
                            aria-label={`Excluir ${item.titulo}`}
                          >
                            <Trash2 size={16} className="text-destructive" />
                          </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remover registro?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Tem certeza que deseja remover {item.titulo}? Esta ação não pode ser desfeita.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteItem(item.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Remover
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>

                  {item.descricao && (
                    <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">{item.descricao}</p>
                  )}

                  <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
                    <span>{formatDateBR(item.data_registro)}</span>
                    {item.produto_relacionado && <span>Produto: {item.produto_relacionado}</span>}
                    {item.cliente && <span>Cliente: {item.cliente}</span>}
                    {item.canal && <span>{canalLabels[item.canal]}</span>}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
