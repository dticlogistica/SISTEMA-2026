import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Box, ArrowUpFromLine, FileText, Settings, Menu, X, PackageSearch, User as UserIcon, RefreshCw } from 'lucide-react';
import { inventoryService } from '../services/inventoryService';
import { User, UserRole } from '../types';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const location = useLocation();

  useEffect(() => {
    inventoryService.getCurrentUser().then(setCurrentUser);
  }, []);

  // Permission Logic
  const canAccess = (allowedRoles: UserRole[]) => {
    if (!currentUser) return false;
    return allowedRoles.includes(currentUser.role);
  };

  const allNavItems = [
    { 
      name: 'Dashboard', 
      path: '/', 
      icon: <LayoutDashboard size={20} />, 
      roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.OPERATOR] 
    },
    { 
      name: 'Estoque Geral', 
      path: '/inventory', 
      icon: <PackageSearch size={20} />, 
      roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.OPERATOR] 
    },
    { 
      name: 'Distribuição', 
      path: '/distribution', 
      icon: <ArrowUpFromLine size={20} />, 
      roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.OPERATOR] 
    },
    { 
      name: 'Entrada / NE', 
      path: '/entry', 
      icon: <Box size={20} />, 
      roles: [UserRole.ADMIN, UserRole.MANAGER] // Operator cannot see
    },
    { 
      name: 'Relatórios', 
      path: '/reports', 
      icon: <FileText size={20} />, 
      roles: [UserRole.ADMIN, UserRole.MANAGER] // Operator cannot see
    },
    { 
      name: 'Configurações', 
      path: '/settings', 
      icon: <Settings size={20} />, 
      roles: [UserRole.ADMIN] // Only Admin
    },
  ];

  const filteredNav = allNavItems.filter(item => canAccess(item.roles));

  // Helper to switch users for demo purposes
  const handleSwitchUser = async () => {
     // Cycle: Admin -> Manager -> Operator -> Admin
     const roles = [UserRole.ADMIN, UserRole.MANAGER, UserRole.OPERATOR];
     const currentIdx = roles.indexOf(currentUser?.role || UserRole.ADMIN);
     const nextIdx = (currentIdx + 1) % roles.length;
     
     // In a real app, this would be a logout/login. Here we call the service helper.
     const newUser = await inventoryService.switchUser(nextIdx);
     setCurrentUser(newUser);
     window.location.reload(); // Reload to apply permissions globally
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden print:h-auto print:overflow-visible">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-primary text-white shadow-xl z-10 print:hidden">
        <div className="p-6 border-b border-slate-700">
          <h1 className="text-2xl font-bold text-accent tracking-tight">Almoxarifado<span className="text-white">Pro</span></h1>
          <p className="text-xs text-slate-400 mt-1">Gestão Inteligente</p>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {filteredNav.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                  isActive 
                    ? 'bg-accent text-white shadow-md' 
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                {item.icon}
                <span className="font-medium">{item.name}</span>
              </Link>
            );
          })}

          <button
            onClick={handleRefresh}
            className="flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 text-slate-300 hover:bg-slate-800 hover:text-white w-full text-left mt-4 border-t border-slate-700 pt-4"
          >
            <RefreshCw size={20} />
            <span className="font-medium">Sincronizar</span>
          </button>
        </nav>
        <div className="p-4 border-t border-slate-700 cursor-pointer hover:bg-slate-800 transition-colors" onClick={handleSwitchUser} title="Clique para alternar usuário (Demo)">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
              currentUser?.role === UserRole.ADMIN ? 'bg-purple-600' : 
              currentUser?.role === UserRole.MANAGER ? 'bg-emerald-600' : 'bg-blue-600'
            }`}>
              {currentUser?.name.charAt(0)}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-medium truncate">{currentUser?.name || 'Carregando...'}</p>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider">{currentUser?.role}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 bg-primary text-white z-50 px-4 py-3 flex items-center justify-between shadow-md print:hidden">
        <span className="font-bold text-lg">AlmoxarifadoPro</span>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
          {isMobileMenuOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden print:hidden" onClick={() => setIsMobileMenuOpen(false)}>
           <div className="absolute right-0 top-0 bottom-0 w-64 bg-primary p-4 pt-16 space-y-2" onClick={e => e.stopPropagation()}>
             {filteredNav.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg ${
                    location.pathname === item.path ? 'bg-accent text-white' : 'text-slate-300'
                  }`}
                >
                  {item.icon}
                  <span>{item.name}</span>
                </Link>
             ))}

             <button
                onClick={handleRefresh}
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 w-full text-left mt-4 border-t border-slate-700 pt-4"
              >
                <RefreshCw size={20} />
                <span>Sincronizar</span>
             </button>
             
             <div className="mt-8 border-t border-slate-700 pt-4" onClick={handleSwitchUser}>
                <div className="flex items-center gap-3 text-slate-300">
                   <UserIcon size={20} />
                   <div>
                     <p className="text-sm">{currentUser?.name}</p>
                     <p className="text-xs opacity-50">{currentUser?.role}</p>
                   </div>
                </div>
             </div>
           </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pt-16 md:pt-0 p-4 md:p-8 relative print:overflow-visible print:h-auto print:p-0">
        {children}
      </main>
    </div>
  );
};

export default Layout;