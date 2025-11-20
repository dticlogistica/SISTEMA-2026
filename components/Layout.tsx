
import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Box, ArrowUpFromLine, FileText, Settings, Menu, X, PackageSearch, User as UserIcon, RefreshCw, LogIn, LogOut } from 'lucide-react';
import { inventoryService } from '../services/inventoryService';
import { User, UserRole } from '../types';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  // Inicializa como VISITANTE por padrão para que o menu apareça imediatamente
  // Isso melhora a UX enquanto os dados reais estão sendo carregados
  const [currentUser, setCurrentUser] = useState<User>({ 
      email: '', name: 'Carregando...', role: UserRole.GUEST, active: true 
  });
  const location = useLocation();

  useEffect(() => {
    // Função de carga inicial
    const loadUser = async () => {
      const user = await inventoryService.getCurrentUser();
      setCurrentUser(user);
    };
    
    loadUser();

    // Inscrever para atualizações futuras (quando o cache for atualizado em background)
    const unsubscribe = inventoryService.subscribe(() => {
      loadUser();
    });

    return unsubscribe;
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
      roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.OPERATOR, UserRole.GUEST] 
    },
    { 
      name: 'Estoque Geral', 
      path: '/inventory', 
      icon: <PackageSearch size={20} />, 
      roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.OPERATOR, UserRole.GUEST] 
    },
    { 
      name: 'Relatórios', 
      path: '/reports', 
      icon: <FileText size={20} />, 
      roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.GUEST] // GUEST CAN VIEW
    },
    { 
      name: 'Distribuição', 
      path: '/distribution', 
      icon: <ArrowUpFromLine size={20} />, 
      roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.OPERATOR] // Restricted
    },
    { 
      name: 'Entrada / NE', 
      path: '/entry', 
      icon: <Box size={20} />, 
      roles: [UserRole.ADMIN, UserRole.MANAGER] // Restricted
    },
    { 
      name: 'Configurações', 
      path: '/settings', 
      icon: <Settings size={20} />, 
      roles: [UserRole.ADMIN] // Only Admin
    },
  ];

  const filteredNav = allNavItems.filter(item => canAccess(item.roles));

  // Helper to switch users for demo purposes (acts as Login/Logout)
  const handleSwitchUser = async () => {
     if (currentUser?.role === UserRole.GUEST) {
         // If Guest, log in as Admin (Simulated Login)
         const allUsers = await inventoryService.getUsers();
         if (allUsers.length > 0) {
             const admin = allUsers.find(u => u.role === UserRole.ADMIN) || allUsers[0];
             await inventoryService.switchUser(allUsers.indexOf(admin));
         } else {
             // If no users loaded yet, fallback logic in service
             await inventoryService.switchUser(0); 
         }
     } else {
         // If Logged in, cycle through roles: Admin -> Manager -> Operator -> Guest (Logout)
         const roles = [UserRole.ADMIN, UserRole.MANAGER, UserRole.OPERATOR];
         const currentIdx = roles.indexOf(currentUser?.role || UserRole.ADMIN);
         
         if (currentIdx === roles.length - 1) {
             // Last role -> Logout to Guest
             await inventoryService.logout();
         } else {
             // Next role
             const allUsers = await inventoryService.getUsers();
             // Logic to find next user of different role (simplified for demo)
             await inventoryService.switchUser(currentIdx + 1);
         }
     }
  };

  const handleRefresh = async () => {
    // Trigger a background refresh
    await inventoryService.refreshData();
  };

  const isGuest = currentUser?.role === UserRole.GUEST;

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden print:h-auto print:overflow-visible">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-primary text-white shadow-xl z-10 print:hidden">
        <div className="p-6 border-b border-slate-700">
          <h1 className="text-xl font-bold text-accent tracking-tight leading-tight">SISTEMA <span className="text-white">DTIC-PRÓ</span></h1>
          <p className="text-xs font-bold text-slate-300 mt-2">GESTÃO DE ALMOXARIFADO</p>
          <p className="text-[10px] text-slate-500 mt-0.5">Seção Logística - 2026</p>
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
        
        <div className="p-4 border-t border-slate-700 cursor-pointer hover:bg-slate-800 transition-colors" onClick={handleSwitchUser} title={isGuest ? "Fazer Login" : "Alternar Usuário / Sair"}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
              isGuest ? 'bg-slate-600' :
              currentUser?.role === UserRole.ADMIN ? 'bg-purple-600' : 
              currentUser?.role === UserRole.MANAGER ? 'bg-emerald-600' : 'bg-blue-600'
            }`}>
              {isGuest ? <UserIcon size={20} /> : currentUser?.name.charAt(0)}
            </div>
            <div className="overflow-hidden flex-1">
              <p className="text-sm font-medium truncate">{currentUser?.name || 'Carregando...'}</p>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider">{currentUser?.role}</p>
            </div>
            <div>
                {isGuest ? <LogIn size={16} className="text-accent" /> : <LogOut size={16} className="text-slate-500" />}
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 bg-primary text-white z-50 px-4 py-3 flex items-center justify-between shadow-md print:hidden">
        <div className="flex flex-col">
             <span className="font-bold text-lg leading-none">DTIC-PRÓ</span>
             <span className="text-[10px] text-slate-400">Seção Logística - 2026</span>
        </div>
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
                   <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                      isGuest ? 'bg-slate-600' : 'bg-accent'
                   }`}>
                      {isGuest ? <UserIcon size={16} /> : currentUser?.name.charAt(0)}
                   </div>
                   <div className="flex-1">
                     <p className="text-sm">{currentUser?.name}</p>
                     <p className="text-xs opacity-50">{currentUser?.role}</p>
                   </div>
                   {isGuest ? <LogIn size={16} /> : <LogOut size={16} />}
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
