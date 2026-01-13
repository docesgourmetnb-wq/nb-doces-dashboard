import { useState } from 'react';
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  Factory, 
  Warehouse, 
  DollarSign,
  Menu,
  X,
  Cookie,
  LogOut,
  Users
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';

interface AppSidebarProps {
  currentPage: string;
  onPageChange: (page: string) => void;
}

const menuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'produtos', label: 'Produtos', icon: Package },
  { id: 'clientes', label: 'Clientes', icon: Users },
  { id: 'vendas', label: 'Vendas', icon: ShoppingCart },
  { id: 'producao', label: 'Produção', icon: Factory },
  { id: 'estoque', label: 'Estoque', icon: Warehouse },
  { id: 'financeiro', label: 'Financeiro', icon: DollarSign },
];

export function AppSidebar({ currentPage, onPageChange }: AppSidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { signOut, user } = useAuth();

  const handleLogout = async () => {
    await signOut();
  };

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-primary text-primary-foreground shadow-chocolate"
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Overlay for mobile */}
      {isOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/50 z-30"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed lg:static inset-y-0 left-0 z-40 w-64 gradient-chocolate text-primary-foreground transform transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-accent rounded-lg shadow-md">
                <Cookie className="w-6 h-6 text-accent-foreground" />
              </div>
              <div>
                <h1 className="font-display text-xl font-semibold">NB Doces</h1>
                <p className="text-xs text-white/70">Gourmet</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPage === item.id;
              
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onPageChange(item.id);
                    setIsOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 text-left",
                    isActive 
                      ? "bg-accent text-accent-foreground shadow-md" 
                      : "text-white/80 hover:bg-white/10 hover:text-white"
                  )}
                >
                  <Icon size={20} />
                  <span className="font-medium">{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* User & Logout */}
          <div className="p-4 border-t border-white/10 space-y-3">
            {user && (
              <p className="text-xs text-white/60 truncate px-2">
                {user.email}
              </p>
            )}
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-2 rounded-lg text-white/70 hover:bg-white/10 hover:text-white transition-colors"
            >
              <LogOut size={18} />
              <span className="text-sm">Sair</span>
            </button>
            <p className="text-xs text-white/50 text-center">
              © 2024 NB Doces Gourmet
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
