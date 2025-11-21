
import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Box, ArrowUpFromLine, FileText, Settings, LogIn, LogOut, RefreshCw, PackageSearch, Lock, X } from 'lucide-react';
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
        
        <div className="p-4 border-t border-slate-700">
          {isGuest ? (
             <button 
               onClick={() => setIsLoginOpen(true)}
               className="w-full flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-lg transition-colors font-bold"
             >
               <LogIn size={18} /> Fazer Login
             </button>
          ) : (
            <div className="flex items-center justify-between">
               <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                    currentUser.role === UserRole.ADMIN ? 'bg-purple-600' : 
                    currentUser.role === UserRole.MANAGER ? 'bg-emerald-600' : 'bg-blue-600'
                  }`}>
                    {currentUser.name.charAt(0)}
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-sm font-bold truncate w-24">{currentUser.name}</p>
                    <p className="text-[10px] text-slate-400 uppercase">{currentUser.role}</p>
                  </div>
               </div>
               <button onClick={handleLogout} className="text-slate-400 hover:text-red-400" title="Sair">
                 <LogOut size={18} />
               </button>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 w-full bg-primary text-white z-20 p-4 flex justify-between items-center print:hidden">
         <h1 className="font-bold">DTIC-PRÓ</h1>
         <div className="flex gap-4">
            {isGuest ? (
               <button onClick={() => setIsLoginOpen(true)}><LogIn size={24} /></button>
            ) : (
               <button onClick={handleLogout}><LogOut size={24} /></button>
            )}
         </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-4 md:p-8 mt-14 md:mt-0 print:p-0 print:mt-0">
        {children}
      </main>

      {/* Modal de Login */}
      {isLoginOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 animate-fade-in backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden relative">
            <button 
               onClick={() => setIsLoginOpen(false)}
               className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
            >
              <X size={20} />
            </button>
            
            <div className="p-8">
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-100 rounded-full mb-4 text-slate-700">
                  <Lock size={32} />
                </div>
                <h2 className="text-2xl font-bold text-slate-800">Acesso Restrito</h2>
                <p className="text-slate-500 text-sm mt-1">Entre com suas credenciais de servidor.</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                {loginError && (
                  <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg text-center border border-red-100 font-medium animate-pulse">
                    {loginError}
                  </div>
                )}
                
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Usuário ou E-mail</label>
                  <input 
                    type="text" 
                    required
                    autoFocus
                    className="w-full p-3 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-accent outline-none"
                    placeholder="admin ou seu@email.com"
                    value={loginEmail}
                    onChange={e => { setLoginEmail(e.target.value); setLoginError(''); }}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Senha</label>
                  <input 
                    type="password" 
                    required
                    className="w-full p-3 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-accent outline-none"
                    placeholder="••••••"
                    value={loginPass}
                    onChange={e => { setLoginPass(e.target.value); setLoginError(''); }}
                  />
                </div>

                <button 
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-slate-900 text-white font-bold rounded-lg hover:bg-slate-800 transition-colors shadow-lg disabled:opacity-70 flex justify-center"
                >
                  {loading ? <RefreshCw className="animate-spin" /> : 'Entrar no Sistema'}
                </button>
              </form>

              <div className="mt-6 text-center border-t border-slate-100 pt-4">
                <p className="text-xs text-slate-400">Não tem acesso? Contate o Administrador.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Layout;
