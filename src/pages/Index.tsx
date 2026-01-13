import { useState } from 'react';
import { AppSidebar } from '@/components/AppSidebar';
import { DashboardPage } from '@/pages/DashboardPage';
import { ProdutosPage } from '@/pages/ProdutosPage';
import { ClientesPage } from '@/pages/ClientesPage';
import { VendasPage } from '@/pages/VendasPage';
import { ProducaoPage } from '@/pages/ProducaoPage';
import { EstoquePage } from '@/pages/EstoquePage';
import { FinanceiroPage } from '@/pages/FinanceiroPage';

const Index = () => {
  const [currentPage, setCurrentPage] = useState('dashboard');

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <DashboardPage />;
      case 'produtos':
        return <ProdutosPage />;
      case 'clientes':
        return <ClientesPage />;
      case 'vendas':
        return <VendasPage />;
      case 'producao':
        return <ProducaoPage />;
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
