import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RecipientesTab } from '@/components/massas/RecipientesTab';
import { MassasCongeladasTab } from '@/components/massas/MassasCongeladasTab';
import { EstoqueMassasTab } from '@/components/massas/EstoqueMassasTab';

export function MassasPage() {
  const [activeTab, setActiveTab] = useState('estoque');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-3xl font-semibold text-foreground">
          Massas Congeladas
        </h1>
        <p className="text-muted-foreground mt-1">
          Controle de recipientes e estoque de massa pronta
        </p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="estoque">Estoque</TabsTrigger>
          <TabsTrigger value="recipientes">Recipientes</TabsTrigger>
          <TabsTrigger value="nova-massa">Nova Massa</TabsTrigger>
        </TabsList>

        <TabsContent value="estoque" className="mt-6">
          <EstoqueMassasTab />
        </TabsContent>

        <TabsContent value="recipientes" className="mt-6">
          <RecipientesTab />
        </TabsContent>

        <TabsContent value="nova-massa" className="mt-6">
          <MassasCongeladasTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
