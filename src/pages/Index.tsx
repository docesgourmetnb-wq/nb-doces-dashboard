import { useEffect, useState } from 'react';
import { AppSidebar } from '@/components/AppSidebar';
import { DashboardPage } from '@/pages/DashboardPage';
import { ProdutosPage } from '@/pages/ProdutosPage';
import { LaboratorioPage } from '@/pages/LaboratorioPage';
import { ClientesPage } from '@/pages/ClientesPage';
import { FornecedoresPage } from '@/pages/FornecedoresPage';
import { VendasPage } from '@/pages/VendasPage';
import { ProducaoPage } from '@/pages/ProducaoPage';
import { EstoquePage } from '@/pages/EstoquePage';
import { FinanceiroPage } from '@/pages/FinanceiroPage';
import { ReceitasPage } from '@/pages/ReceitasPage';
import { useAuth } from '@/hooks/useAuth';

const pageModules: Record<string, string> = {
  dashboard: 'dashboard',
  produtos: 'produtos',
  laboratorio: 'produtos',
  clientes: 'clientes',
  fornecedores: 'estoque',
  vendas: 'pedidos',
  producao: 'producao',
  receitas: 'receitas',
  estoque: 'estoque',
  financeiro: 'financeiro',
};

const Index = () => {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const { canAccess } = useAuth();

  useEffect(() => {
    const moduleId = pageModules[currentPage] || 'dashboard';
    if (!canAccess(moduleId)) setCurrentPage('dashboard');
  }, [canAccess, currentPage]);

  const renderPage = () => {
    const moduleId = pageModules[currentPage] || 'dashboard';
    if (!canAccess(moduleId)) {
      return (
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="max-w-md text-center space-y-2">
            <h1 className="font-display text-2xl font-semibold text-foreground">Acesso restrito</h1>
            <p className="text-muted-foreground">Seu perfil não tem permissão para acessar este módulo.</p>
          </div>
        </div>
      );
    }

    switch (currentPage) {
      case 'dashboard':
        return <DashboardPage />;
      case 'produtos':
        return <ProdutosPage />;
      case 'laboratorio':
        return <LaboratorioPage />;
      case 'clientes':
        return <ClientesPage />;
      case 'fornecedores':
        return <FornecedoresPage />;
      case 'vendas':
        return <VendasPage />;
      case 'producao':
        return <ProducaoPage />;
      case 'receitas':
        return <ReceitasPage />;
      case 'estoque':
        return <EstoquePage />;
      case 'financeiro':
        return <FinanceiroPage />;
      default:
        return <DashboardPage />;
    }
  };

  return (
    <div className="flex min-h-screen w-full bg-background">
      <AppSidebar currentPage={currentPage} onPageChange={setCurrentPage} />
      
      <main className="flex-1 lg:ml-0 p-4 lg:p-8 pt-16 lg:pt-8 overflow-auto">
        <div className="max-w-7xl mx-auto">
          {renderPage()}
        </div>
      </main>
    </div>
  );
};

export default Index;
