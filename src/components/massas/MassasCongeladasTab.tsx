import { useState, useRef } from 'react';
import { Camera, Loader2, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useRecipientes } from '@/hooks/useRecipientes';
import { useMassasCongeladas } from '@/hooks/useMassasCongeladas';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { CalendarIcon } from 'lucide-react';

const tipoMassaLabels = {
  branco: 'Branco',
  '100_cacau': '100% Cacau',
  outros: 'Outros',
};

export function MassasCongeladasTab() {
  const { recipientes, loading: loadingRecipientes } = useRecipientes();
  const { addMassa, uploadFoto } = useMassasCongeladas();
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const recipientesDisponiveis = recipientes.filter(r => r.status === 'disponivel');

  const [formData, setFormData] = useState({
    recipiente_id: '',
    tipo_massa: 'branco' as 'branco' | '100_cacau' | 'outros',
    peso_total: '',
    data_producao: new Date(),
    data_congelamento: new Date(),
    validade: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days default
    foto_url: null as string | null,
  });

  const selectedRecipiente = recipientes.find(r => r.id === formData.recipiente_id);
  const pesoMassaCalculado = formData.peso_total && selectedRecipiente
    ? parseFloat(formData.peso_total) - selectedRecipiente.peso_vazio
    : 0;

  const resetForm = () => {
    setFormData({
      recipiente_id: '',
      tipo_massa: 'branco',
      peso_total: '',
      data_producao: new Date(),
      data_congelamento: new Date(),
      validade: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      foto_url: null,
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const url = await uploadFoto(file);
    if (url) {
      setFormData(prev => ({ ...prev, foto_url: url }));
    }
    setUploading(false);
  };

  const handleSave = async () => {
    if (!formData.recipiente_id || !formData.peso_total) return;

    setSaving(true);
    const result = await addMassa({
      recipiente_id: formData.recipiente_id,
      tipo_massa: formData.tipo_massa,
      peso_total: parseFloat(formData.peso_total),
      data_producao: formData.data_producao.toISOString().split('T')[0],
      data_congelamento: formData.data_congelamento.toISOString().split('T')[0],
      validade: formData.validade.toISOString().split('T')[0],
      foto_url: formData.foto_url,
    });

    if (result) {
      resetForm();
    }
    setSaving(false);
  };

  if (loadingRecipientes) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (recipientesDisponiveis.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground mb-4">
            Não há recipientes disponíveis. Cadastre seus pratos de vidro primeiro.
          </p>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Ir para Recipientes
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="h-5 w-5" />
          Registrar Nova Massa Congelada
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Photo Upload */}
        <div className="flex flex-col items-center gap-2">
          {formData.foto_url ? (
            <img
              src={formData.foto_url}
              alt="Foto da massa"
              className="w-40 h-40 object-cover rounded-lg"
            />
          ) : (
            <div className="w-40 h-40 bg-muted rounded-lg flex items-center justify-center">
              <Camera className="h-10 w-10 text-muted-foreground" />
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
                {formData.foto_url ? 'Trocar Foto' : 'Foto do Prato Cheio'}
              </>
            )}
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {/* Recipiente */}
          <div className="space-y-2">
            <Label>Recipiente (Prato) *</Label>
            <Select
              value={formData.recipiente_id}
              onValueChange={value => setFormData(prev => ({ ...prev, recipiente_id: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o prato" />
              </SelectTrigger>
              <SelectContent>
                {recipientesDisponiveis.map(r => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.codigo} - {r.peso_vazio}g
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedRecipiente && (
              <p className="text-xs text-muted-foreground">
                Peso do prato vazio: <strong>{selectedRecipiente.peso_vazio}g</strong>
              </p>
            )}
          </div>

          {/* Tipo de Massa */}
          <div className="space-y-2">
            <Label>Tipo de Massa *</Label>
            <Select
              value={formData.tipo_massa}
              onValueChange={(value: 'branco' | '100_cacau' | 'outros') =>
                setFormData(prev => ({ ...prev, tipo_massa: value }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="branco">Branco</SelectItem>
                <SelectItem value="100_cacau">100% Cacau</SelectItem>
                <SelectItem value="outros">Outros</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Peso Total */}
          <div className="space-y-2">
            <Label>Peso Total (prato + massa) *</Label>
            <Input
              type="number"
              placeholder="Peso na balança em gramas"
              value={formData.peso_total}
              onChange={e => setFormData(prev => ({ ...prev, peso_total: e.target.value }))}
            />
          </div>

          {/* Peso Calculado */}
          <div className="space-y-2">
            <Label>Peso da Massa (calculado)</Label>
            <div className="h-10 px-3 py-2 border rounded-md bg-muted flex items-center">
              <span className={cn(
                "font-semibold",
                pesoMassaCalculado > 0 ? "text-green-600" : "text-muted-foreground"
              )}>
                {pesoMassaCalculado > 0 ? `${pesoMassaCalculado.toFixed(0)}g` : 'Selecione prato e peso'}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Peso total − Peso do prato vazio
            </p>
          </div>

          {/* Data Produção */}
          <div className="space-y-2">
            <Label>Data de Produção</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(formData.data_producao, "dd/MM/yyyy", { locale: ptBR })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 z-50">
                <Calendar
                  mode="single"
                  selected={formData.data_producao}
                  onSelect={date => date && setFormData(prev => ({ ...prev, data_producao: date }))}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Data Congelamento */}
          <div className="space-y-2">
            <Label>Data de Congelamento</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(formData.data_congelamento, "dd/MM/yyyy", { locale: ptBR })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 z-50">
                <Calendar
                  mode="single"
                  selected={formData.data_congelamento}
                  onSelect={date => date && setFormData(prev => ({ ...prev, data_congelamento: date }))}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Validade */}
          <div className="space-y-2 md:col-span-2">
            <Label>Validade</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full md:w-auto justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(formData.validade, "dd/MM/yyyy", { locale: ptBR })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 z-50">
                <Calendar
                  mode="single"
                  selected={formData.validade}
                  onSelect={date => date && setFormData(prev => ({ ...prev, validade: date }))}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-4">
          <Button
            size="lg"
            onClick={handleSave}
            disabled={saving || !formData.recipiente_id || !formData.peso_total || pesoMassaCalculado <= 0}
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Registrar Massa ({pesoMassaCalculado > 0 ? `${pesoMassaCalculado.toFixed(0)}g` : '0g'})
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
