import { useState, useRef } from 'react';
import { Plus, Edit2, Trash2, Camera, Loader2 } from 'lucide-react';
import { useRecipientes, Recipiente } from '@/hooks/useRecipientes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const statusLabels = {
  disponivel: 'Disponível',
  em_uso: 'Em Uso',
  inativo: 'Inativo',
};

const statusColors = {
  disponivel: 'bg-green-100 text-green-800',
  em_uso: 'bg-amber-100 text-amber-800',
  inativo: 'bg-gray-100 text-gray-800',
};

export function RecipientesTab() {
  const { recipientes, loading, addRecipiente, updateRecipiente, deleteRecipiente, uploadFoto } = useRecipientes();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRecipiente, setEditingRecipiente] = useState<Recipiente | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    codigo: '',
    tipo_recipiente: 'Prato de vidro',
    peso_vazio: '',
    capacidade_aproximada: '',
    observacoes: '',
    status: 'disponivel' as Recipiente['status'],
    foto_url: null as string | null,
  });

  const resetForm = () => {
    setFormData({
      codigo: '',
      tipo_recipiente: 'Prato de vidro',
      peso_vazio: '',
      capacidade_aproximada: '',
      observacoes: '',
      status: 'disponivel',
      foto_url: null,
    });
    setEditingRecipiente(null);
  };

  const handleOpenDialog = (recipiente?: Recipiente) => {
    if (recipiente) {
      setEditingRecipiente(recipiente);
      setFormData({
        codigo: recipiente.codigo,
        tipo_recipiente: recipiente.tipo_recipiente,
        peso_vazio: String(recipiente.peso_vazio),
        capacidade_aproximada: recipiente.capacidade_aproximada ? String(recipiente.capacidade_aproximada) : '',
        observacoes: recipiente.observacoes || '',
        status: recipiente.status,
        foto_url: recipiente.foto_url,
      });
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const url = await uploadFoto(file, formData.codigo || 'temp');
    if (url) {
      setFormData(prev => ({ ...prev, foto_url: url }));
    }
    setUploading(false);
  };

  const handleSave = async () => {
    if (!formData.codigo || !formData.peso_vazio) return;

    setSaving(true);
    const data = {
      codigo: formData.codigo,
      tipo_recipiente: formData.tipo_recipiente,
      peso_vazio: parseFloat(formData.peso_vazio),
      capacidade_aproximada: formData.capacidade_aproximada ? parseFloat(formData.capacidade_aproximada) : null,
      observacoes: formData.observacoes || null,
      status: formData.status,
      foto_url: formData.foto_url,
    };

    if (editingRecipiente) {
      await updateRecipiente(editingRecipiente.id, data);
    } else {
      await addRecipiente(data);
    }

    setSaving(false);
    setIsDialogOpen(false);
    resetForm();
  };

  const handleDelete = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir este recipiente?')) {
      await deleteRecipiente(id);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold">Recipientes Cadastrados</h2>
          <p className="text-sm text-muted-foreground">
            {recipientes.length} recipiente(s)
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Recipiente
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingRecipiente ? 'Editar Recipiente' : 'Novo Recipiente'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              {/* Photo */}
              <div className="flex flex-col items-center gap-2">
                {formData.foto_url ? (
                  <img
                    src={formData.foto_url}
                    alt="Foto do recipiente"
                    className="w-32 h-32 object-cover rounded-lg"
                  />
                ) : (
                  <div className="w-32 h-32 bg-muted rounded-lg flex items-center justify-center">
                    <Camera className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  className="hidden"
                  onChange={handleFileChange}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Camera className="h-4 w-4 mr-2" />
                      {formData.foto_url ? 'Trocar Foto' : 'Adicionar Foto'}
                    </>
                  )}
                </Button>
              </div>

              {/* Code */}
              <div className="space-y-2">
                <Label>Código do Prato *</Label>
                <Input
                  placeholder="Ex: PV-01"
                  value={formData.codigo}
                  onChange={e => setFormData(prev => ({ ...prev, codigo: e.target.value }))}
                  disabled={!!editingRecipiente}
                />
              </div>

              {/* Type */}
              <div className="space-y-2">
                <Label>Tipo de Recipiente</Label>
                <Input
                  placeholder="Prato de vidro"
                  value={formData.tipo_recipiente}
                  onChange={e => setFormData(prev => ({ ...prev, tipo_recipiente: e.target.value }))}
                />
              </div>

              {/* Weight */}
              <div className="space-y-2">
                <Label>Peso Vazio (g) *</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={formData.peso_vazio}
                  onChange={e => setFormData(prev => ({ ...prev, peso_vazio: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">
                  ⚠️ Este valor não deve ser alterado após o cadastro
                </p>
              </div>

              {/* Capacity */}
              <div className="space-y-2">
                <Label>Capacidade Aproximada (g)</Label>
                <Input
                  type="number"
                  placeholder="Opcional"
                  value={formData.capacidade_aproximada}
                  onChange={e => setFormData(prev => ({ ...prev, capacidade_aproximada: e.target.value }))}
                />
              </div>

              {/* Status */}
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value: Recipiente['status']) => 
                    setFormData(prev => ({ ...prev, status: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="disponivel">Disponível</SelectItem>
                    <SelectItem value="em_uso">Em Uso</SelectItem>
                    <SelectItem value="inativo">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea
                  placeholder="Observações opcionais..."
                  value={formData.observacoes}
                  onChange={e => setFormData(prev => ({ ...prev, observacoes: e.target.value }))}
                />
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setIsDialogOpen(false);
                    resetForm();
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleSave}
                  disabled={saving || !formData.codigo || !formData.peso_vazio}
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    'Salvar'
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* List */}
      {recipientes.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              Nenhum recipiente cadastrado. Comece adicionando seus pratos de vidro.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {recipientes.map(recipiente => (
            <Card key={recipiente.id} className="overflow-hidden">
              {recipiente.foto_url && (
                <div className="aspect-video bg-muted">
                  <img
                    src={recipiente.foto_url}
                    alt={recipiente.codigo}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-semibold text-lg">{recipiente.codigo}</h3>
                    <p className="text-sm text-muted-foreground">{recipiente.tipo_recipiente}</p>
                  </div>
                  <Badge className={statusColors[recipiente.status]}>
                    {statusLabels[recipiente.status]}
                  </Badge>
                </div>

                <div className="space-y-1 text-sm mb-4">
                  <p>
                    <span className="text-muted-foreground">Peso vazio:</span>{' '}
                    <strong>{recipiente.peso_vazio}g</strong>
                  </p>
                  {recipiente.capacidade_aproximada && (
                    <p>
                      <span className="text-muted-foreground">Capacidade:</span>{' '}
                      {recipiente.capacidade_aproximada}g
                    </p>
                  )}
                  {recipiente.observacoes && (
                    <p className="text-muted-foreground italic">
                      {recipiente.observacoes}
                    </p>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleOpenDialog(recipiente)}
                  >
                    <Edit2 className="h-4 w-4 mr-1" />
                    Editar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleDelete(recipiente.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
