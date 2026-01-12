import { useInsumos } from '@/hooks/useInsumos';
import { AlertTriangle, CheckCircle } from 'lucide-react';

export function AlertaEstoqueBaixo() {
  const { insumos, loading } = useInsumos();

  if (loading) {
    return (
      <div className="bg-muted rounded-xl p-4 animate-pulse">
        <div className="h-4 bg-muted-foreground/20 rounded w-1/2"></div>
      </div>
    );
  }

  const insumosEmFalta = insumos.filter(
    (insumo) => insumo.quantidade_atual <= insumo.quantidade_minima
  );

  if (insumosEmFalta.length === 0) {
    return (
      <div className="bg-success/10 border border-success/20 rounded-xl p-4 flex items-center gap-2">
        <CheckCircle className="w-5 h-5 text-success" />
        <p className="text-success font-medium text-sm">
          Todos os insumos estão em nível adequado
        </p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 bg-warning/20 rounded-lg">
          <AlertTriangle className="w-5 h-5 text-warning" />
        </div>
        <h3 className="font-display font-semibold text-lg">Alerta de Estoque</h3>
      </div>
      
      <div className="space-y-3">
        {insumosEmFalta.map((insumo) => {
          const percentual = (insumo.quantidade_atual / insumo.quantidade_minima) * 100;
          const isCritical = percentual < 50;
          
          return (
            <div key={insumo.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div>
                <p className="font-medium text-sm">{insumo.nome}</p>
                <p className="text-xs text-muted-foreground">
                  {insumo.quantidade_atual} {insumo.unidade} restante(s)
                </p>
              </div>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                isCritical 
                  ? 'bg-destructive/20 text-destructive' 
                  : 'bg-warning/20 text-warning'
              }`}>
                {isCritical ? 'Crítico' : 'Baixo'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
