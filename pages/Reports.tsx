
import React, { useEffect, useState } from 'react';
import { inventoryService } from '../services/inventoryService';
import { Movement, MovementType, User, UserRole, Product } from '../types';
import { FileText, Filter, Download, ArrowDownCircle, ArrowUpCircle, Search, Printer, RotateCcw, RefreshCw, Lock, ChevronLeft, ChevronRight, Package } from 'lucide-react';

const Reports: React.FC = () => {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredMovements, setFilteredMovements] = useState<Movement[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  
  // Filters
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | MovementType>('ALL');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  const loadData = async () => {
    try {
      const user = await inventoryService.getCurrentUser();
      setCurrentUser(user);
      
      // Carrega movimentações e produtos para cruzar informações de saldo
      const [movsData, prodsData] = await Promise.all([
        inventoryService.getMovements(),
        inventoryService.getProducts()
      ]);

      setMovements(movsData);
      setProducts(prodsData);
      setFilteredMovements(movsData); 
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    return inventoryService.subscribe(loadData);
  }, []);

  useEffect(() => {
    let result = movements;
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(m => m.productName.toLowerCase().includes(s) || m.neId.toLowerCase().includes(s) || m.observation?.toLowerCase().includes(s));
    }
    if (typeFilter !== 'ALL') result = result.filter(m => m.type === typeFilter);
    if (dateStart) result = result.filter(m => new Date(m.date) >= new Date(dateStart));
    if (dateEnd) {
       const end = new Date(dateEnd);
       end.setHours(23, 59, 59);
       result = result.filter(m => new Date(m.date) <= end);
    }
    setFilteredMovements(result);
    setCurrentPage(1); // Reset pagination on filter change
  }, [search, typeFilter, dateStart, dateEnd, movements]);

  const handleReverse = async (movementId: string) => {
    if (!window.confirm('Deseja realmente estornar esta saída?')) return;
    setProcessingId(movementId);
    try {
      const success = await inventoryService.reverseMovement(movementId, 'admin@sys.com');
      if (success) alert('Estorno realizado.');
    } catch (e) { alert('Erro de rede.'); } 
    finally { setProcessingId(null); }
  };

  // Helper para encontrar saldo
  const getProductBalance = (productId: string) => {
    const prod = products.find(p => p.id === productId);
    return prod ? { balance: prod.currentBalance, unit: prod.unit } : null;
  };

  const canUserReverse = currentUser && (currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.MANAGER);
  const activeMovements = filteredMovements.filter(m => m.type !== MovementType.REVERSAL && !m.isReversed);
  const totalEntry = activeMovements.filter(m => m.type === MovementType.ENTRY).reduce((acc, m) => acc + m.value, 0);
  const totalExit = activeMovements.filter(m => m.type === MovementType.EXIT).reduce((acc, m) => acc + m.value, 0);

  // Pagination Logic
  const totalPages = Math.ceil(filteredMovements.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentData = filteredMovements.slice(startIndex, startIndex + itemsPerPage);

  if (loading) return <div className="p-8 text-center text-slate-500">Carregando relatórios...</div>;

  return (
    <div className="space-y-6">
      <div className="hidden print:block mb-8 text-center border-b-2 border-slate-800 pb-4">
        <h1 className="font-bold text-xl text-slate-900 uppercase tracking-wide">POLICIA MILITAR DO ESTADO DE SÃO PAULO</h1>
        <h2 className="font-bold text-lg text-slate-900 uppercase tracking-wide">Diretoria de Tecnologia da Informação e Comunicação</h2>
        <p className="text-sm font-bold text-slate-700 uppercase mt-1">Seção Logística - 2026</p>
        <h3 className="font-bold text-lg text-slate-900 uppercase tracking-wide mt-4">Relatório de Movimentações</h3>
        <div className="mt-4 flex justify-between items-end text-sm text-slate-600">
          <div className="text-left">
            <p><strong>Gerado em:</strong> {new Date().toLocaleString('pt-BR')}</p>
            <p><strong>Filtro:</strong> {typeFilter === 'ALL' ? 'Todos' : typeFilter}</p>
          </div>
          <div className="text-right">
            <p>Total Entradas: <strong>R$ {totalEntry.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></p>
            <p>Total Saídas: <strong>R$ {totalExit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></p>
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center print:hidden">
        <div>
          <h2 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
            <FileText className="text-indigo-600" /> Relatório de Movimentações
          </h2>
          <p className="text-slate-500 mt-2">Histórico completo de auditoria.</p>
        </div>
        <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-all shadow-sm">
          <Printer size={18} /> Imprimir / PDF
        </button>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 print:hidden">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
           <div><p className="text-slate-500 text-xs font-bold uppercase">Entradas</p><p className="text-2xl font-bold text-emerald-600">R$ {totalEntry.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></div>
           <ArrowDownCircle className="text-emerald-100 fill-emerald-500 h-10 w-10" />
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
           <div><p className="text-slate-500 text-xs font-bold uppercase">Saídas</p><p className="text-2xl font-bold text-orange-600">R$ {totalExit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></div>
           <ArrowUpCircle className="text-orange-100 fill-orange-500 h-10 w-10" />
        </div>
        <div className="bg-slate-800 text-white p-4 rounded-xl border border-slate-700 shadow-sm flex items-center justify-between">
           <div><p className="text-slate-400 text-xs font-bold uppercase">Registros</p><p className="text-2xl font-bold">{filteredMovements.length}</p></div>
           <FileText className="text-slate-600 h-10 w-10" />
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 print:hidden">
        <div className="flex flex-col md:flex-row gap-4 items-end md:items-center">
          <div className="flex-1 w-full">
            <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Busca</label>
            <div className="relative"><Search className="absolute left-3 top-2.5 text-slate-400" size={18} /><input type="text" className="w-full pl-10 p-2 bg-slate-50 border border-slate-300 rounded-lg outline-none" placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} /></div>
          </div>
          <div>
             <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Tipo</label>
             <select className="w-full md:w-40 p-2 bg-slate-50 border border-slate-300 rounded-lg outline-none" value={typeFilter} onChange={e => setTypeFilter(e.target.value as any)}>
               <option value="ALL">Todos</option><option value={MovementType.ENTRY}>Entradas</option><option value={MovementType.EXIT}>Saídas</option><option value={MovementType.REVERSAL}>Estornos</option>
             </select>
          </div>
          <div>
             <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Início</label>
             <input type="date" className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg outline-none" value={dateStart} onChange={e => setDateStart(e.target.value)} />
          </div>
          <div>
             <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Fim</label>
             <input type="date" className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg outline-none" value={dateEnd} onChange={e => setDateEnd(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden print:shadow-none print:border-none">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm print:text-xs">
            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200 print:bg-slate-100 print:text-black">
              <tr><th className="p-4 print:p-2">Data / Hora</th><th className="p-4 text-center print:p-2">Tipo</th><th className="p-4 print:p-2">NE Ref.</th><th className="p-4 print:p-2">Produto</th><th className="p-4 text-right print:p-2">Qtd</th><th className="p-4 text-right print:p-2">Valor Total</th><th className="p-4 print:p-2">Usuário / Obs</th>{canUserReverse && <th className="p-4 text-center print:hidden">Ações</th>}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100 print:divide-slate-200">
              {loading ? <tr><td colSpan={canUserReverse ? 8 : 7} className="p-8 text-center">Carregando...</td></tr> : currentData.length === 0 ? <tr><td colSpan={canUserReverse ? 8 : 7} className="p-8 text-center text-slate-400">Nenhum registro.</td></tr> : (
                currentData.map((m) => {
                  const prodInfo = getProductBalance(m.productId);
                  return (
                    <tr key={m.id} className={`transition-colors print:hover:bg-transparent ${m.isReversed ? 'bg-slate-50 opacity-60' : 'hover:bg-slate-50'}`}>
                      <td className="p-4 text-slate-600 whitespace-nowrap print:p-2">{new Date(m.date).toLocaleDateString('pt-BR')} <span className="text-xs text-slate-400 print:hidden">{new Date(m.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span></td>
                      <td className="p-4 text-center print:p-2"><span className={`px-2 py-1 rounded text-xs font-bold ${m.type === MovementType.ENTRY ? 'bg-emerald-100 text-emerald-700' : m.type === MovementType.EXIT ? 'bg-orange-100 text-orange-700' : 'bg-slate-200 text-slate-600'} print:bg-transparent print:border print:border-slate-300`}>{m.type}</span></td>
                      <td className="p-4 font-mono text-slate-600 print:p-2">{m.neId}</td>
                      <td className="p-4 print:p-2">
                        <div className="font-medium text-slate-800">{m.productName}</div>
                        {prodInfo && (
                           <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1" title="Saldo atual deste item nesta Nota de Empenho">
                              <Package size={10} />
                              <span>Saldo NE: <strong>{prodInfo.balance}</strong> {prodInfo.unit}</span>
                           </div>
                        )}
                      </td>
                      <td className="p-4 text-right font-bold print:p-2">{m.quantity}</td>
                      <td className="p-4 text-right text-slate-600 print:p-2">R$ {m.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                      <td className="p-4 max-w-xs truncate print:p-2 print:whitespace-normal">
                        <div className="text-slate-800">{m.userEmail.split('@')[0]}</div>
                        <div className="text-slate-400 text-xs italic truncate print:text-slate-600 print:whitespace-normal" title={m.observation}>{m.observation} {m.isReversed && <span className="text-red-500 font-bold not-italic ml-1">(ESTORNADO)</span>}</div>
                      </td>
                      {canUserReverse && <td className="p-4 text-center print:hidden">{m.type === MovementType.EXIT && !m.isReversed && !((m.type as any) === 'ESTORNO') && <button onClick={() => handleReverse(m.id)} disabled={processingId === m.id} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full" title="Estornar">{processingId === m.id ? <RefreshCw size={16} className="animate-spin" /> : <RotateCcw size={16} />}</button>}</td>}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Controls */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center print:hidden">
            <div className="text-sm text-slate-500">
                Exibindo {startIndex + 1} a {Math.min(startIndex + itemsPerPage, filteredMovements.length)} de {filteredMovements.length} registros
            </div>
            <div className="flex items-center gap-2">
                <div className="mr-4">
                    <select 
                        value={itemsPerPage} 
                        onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                        className="bg-white border border-slate-300 rounded px-2 py-1 text-sm outline-none"
                    >
                        <option value={20}>20 por página</option>
                        <option value={50}>50 por página</option>
                        <option value={100}>100 por página</option>
                        <option value={999999}>Todos</option>
                    </select>
                </div>
                <button 
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="p-2 rounded hover:bg-slate-200 disabled:opacity-50 disabled:hover:bg-transparent"
                >
                    <ChevronLeft size={20} />
                </button>
                <span className="text-sm font-medium px-2">
                    Página {currentPage} de {Math.max(1, totalPages)}
                </span>
                <button 
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages || totalPages === 0}
                    className="p-2 rounded hover:bg-slate-200 disabled:opacity-50 disabled:hover:bg-transparent"
                >
                    <ChevronRight size={20} />
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Reports;
