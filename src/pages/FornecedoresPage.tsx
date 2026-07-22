import { useState } from 'react';
import { Building2, Edit2, Loader2, Mail, Phone, Plus, Search, Trash2 } from 'lucide-react';
import { useFornecedores, type Fornecedor } from '@/hooks/useFornecedores';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
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
import { cn } from '@/lib/utils';

export function FornecedoresPage() {
  const { fornecedores, loading, addFornecedor, updateFornecedor, deleteFornecedor } = useFornecedores();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFornecedor, setEditingFornecedor] = useState<Fornecedor | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [nome, setNome] = useState('');
  const [documento, setDocumento] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [ativo, setAtivo] = useState(true);

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
            {filteredFornecedores.map((fornecedor) => (
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
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
