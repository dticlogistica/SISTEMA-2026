
import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Box, ArrowUpFromLine, FileText, Settings, LogIn, LogOut, RefreshCw, PackageSearch, Lock, X, ShieldCheck, Eye } from 'lucide-react';
import { inventoryService } from '../services/inventoryService';
import { User, UserRole } from '../types';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  // Inicializa como VISITANTE por padrão (acesso via link)
  const [currentUser, setCurrentUser] = useState<User>({ 
      email: 'public@guest.com', name: 'Visitante', role: UserRole.GUEST, active: true 
  });
  const location = useLocation();
  
  // Login Modal State
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadUser = async () => {
      const user = await inventoryService.getCurrentUser();
      setCurrentUser(user);
    };
    
    loadUser();
    const unsubscribe = inventoryService.subscribe(() => {
      loadUser();
    });
    return unsubscribe;
  }, []);

  const canAccess = (allowedRoles: UserRole[]) => {
    // MODIFICAÇÃO: Permite ver o menu se for GUEST, mas o conteúdo da página pode estar bloqueado
    if (!currentUser) return false;
    // Se o usuário for GUEST, mostramos tudo no menu para permitir navegação (modo resgate)
    if (currentUser.role === UserRole.GUEST) return true;
    return allowedRoles.includes(currentUser.role);
  };

  // Ordem Solicitada: Dashboard, Entrada, Distribuição, Estoque, Relatórios, Configurações
  // Roles atualizadas para permitir visualização no menu (GUEST adicionado em tudo)
  const allNavItems = [
    { 
      name: 'Painel de Gestão', 
      path: '/', 
      icon: <LayoutDashboard size={20} />, 
      roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.OPERATOR, UserRole.GUEST] 
    },
    { 
      name: 'Entrada / NE', 
      path: '/entry', 
      icon: <Box size={20} />, 
      roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.GUEST] 
    },
    { 
      name: 'Distribuição', 
      path: '/distribution', 
      icon: <ArrowUpFromLine size={20} />, 
      roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.GUEST] 
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
      roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.GUEST] 
    },
    { 
      name: 'Configurações', 
      path: '/settings', 
      icon: <Settings size={20} />, 
      roles: [UserRole.ADMIN, UserRole.GUEST] 
    },
  ];

  const filteredNav = allNavItems.filter(item => canAccess(item.roles));

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setLoginError('');

    const success = await inventoryService.login(loginEmail, loginPass);
    
    if (success) {
      setIsLoginOpen(false);
      setLoginEmail('');
      setLoginPass('');
    } else {
      setLoginError('E-mail ou senha incorretos.');
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    await inventoryService.logout();
  };

  const handleRefresh = async () => {
    await inventoryService.refreshData();
  };

  const isGuest = currentUser?.role === UserRole.GUEST;

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden print:h-auto print:overflow-visible">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-slate-900 text-white shadow-xl z-10 print:hidden">
        <div className="p-6 border-b border-slate-700">
          <h1 className="text-xl font-bold text-sky-400 tracking-tight leading-tight">SISTEMA <span className="text-white">PMESP</span></h1>
          <p className="text-xs font-bold text-slate-300 mt-2">DTIC - ALMOXARIFADO</p>
          <p className="text-[10px] text-slate-500 mt-0.5">Seção Logística - 2026</p>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {filteredNav.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                  isActive 
                    ? 'bg-sky-600 text-white shadow-md' 
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                {item.icon}
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-700">
           {currentUser && !isGuest ? (
             <div className="flex items-center justify-between bg-slate-800 p-3 rounded-lg">
                <div className="overflow-hidden">
                   <p className="text-xs font-bold text-white truncate">{currentUser.name}</p>
                   <p className="text-[10px] text-slate-400 truncate">{currentUser.email}</p>
                </div>
                <button onClick={handleLogout} className="text-slate-400 hover:text-red-400" title="Sair">
                   <LogOut size={16} />
                </button>
             </div>
           ) : (
             <button 
               onClick={() => setIsLoginOpen(true)}
               className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-lg text-sm font-bold transition-colors"
             >
               <LogIn size={16} /> Acessar Sistema
             </button>
           )}
        </div>
      </aside>

      {/* Mobile Header & Main Content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shadow-sm z-20 print:hidden">
           <div className="md:hidden font-bold text-slate-800">DTIC-PRÓ</div>
           
           <div className="flex items-center gap-4 ml-auto">
              {/* Refresh Button */}
              <button onClick={handleRefresh} className="p-2 text-slate-400 hover:text-sky-600 rounded-full hover:bg-sky-50 transition-colors" title="Atualizar Dados">
                 <RefreshCw size={20} />
              </button>
              
              {/* User Status Badge */}
              {currentUser && (
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border ${
                    isGuest 
                      ? 'bg-slate-100 text-slate-500 border-slate-200' 
                      : 'bg-sky-50 text-sky-700 border-sky-200'
                }`}>
                    {isGuest ? <Eye size={14} /> : <ShieldCheck size={14} />}
                    <span className="uppercase">{currentUser.role}</span>
                </div>
              )}
           </div>
        </header>

        {/* Main Scrollable Area */}
        <main className="flex-1 overflow-auto p-6 md:p-8 print:p-0 print:overflow-visible">
           {children}
        </main>
      </div>

      {/* Login Modal */}
      {isLoginOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
           <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
              <div className="p-6 text-center bg-slate-50 border-b border-slate-100">
                 <div className="mx-auto w-12 h-12 bg-sky-100 rounded-full flex items-center justify-center mb-4 text-sky-600">
                    <Lock size={24} />
                 </div>
                 <h3 className="text-xl font-bold text-slate-800">Acesso Restrito</h3>
                 <p className="text-sm text-slate-500 mt-1">Identifique-se para gerenciar o almoxarifado.</p>
              </div>
              
              <form onSubmit={handleLogin} className="p-6 space-y-4">
                 {loginError && (
                    <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-lg flex items-center gap-2">
                       <X size={16} /> {loginError}
                    </div>
                 )}
                 
                 <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">E-mail</label>
                    <input 
                       type="text" 
                       className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-sky-500 transition-all"
                       placeholder="seu@email.com"
                       value={loginEmail}
                       onChange={e => setLoginEmail(e.target.value)}
                       autoFocus
                    />
                 </div>
                 
                 <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Senha</label>
                    <input 
                       type="password" 
                       className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-sky-500 transition-all"
                       placeholder="••••••"
                       value={loginPass}
                       onChange={e => setLoginPass(e.target.value)}
                    />
                 </div>

                 <button 
                    type="submit" 
                    disabled={loading}
                    className="w-full py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
                 >
                    {loading ? 'Verificando...' : <><LogIn size={18} /> Entrar</>}
                 </button>
              </form>
              
              <div className="p-4 bg-slate-50 text-center border-t border-slate-100">
                 <button onClick={() => setIsLoginOpen(false)} className="text-sm text-slate-500 hover:text-slate-800 font-medium">
                    Continuar como Visitante
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default Layout;
