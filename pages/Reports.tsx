import React, { useEffect, useState } from 'react';
import { inventoryService } from '../services/inventoryService';
import { Movement, MovementType, User, UserRole } from '../types';
import { FileText, Filter, Download, ArrowDownCircle, ArrowUpCircle, Search, Printer, RotateCcw, RefreshCw, Lock } from 'lucide-react';

const Reports: React.FC = () => {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [filteredMovements, setFilteredMovements] = useState<Movement[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  
  // Filters
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | MovementType>('ALL');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');

  const loadData = async () => {
    const user = await inventoryService.getCurrentUser();
    setCurrentUser(user);
    const data = await inventoryService.getMovements();
    setMovements(data);
    setFilteredMovements(data); 
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    let result = movements;

    if (search) {
      const s = search.toLowerCase();
      result = result.filter(m => 
        m.productName.toLowerCase().includes(s) || 
        m.neId.toLowerCase().includes(s) || 
        m.observation?.toLowerCase().includes(s)
      );
    }

    if (typeFilter !== 'ALL') {
      result = result.filter(m => m.type === typeFilter);
    }

    if (dateStart) {
       result = result.filter(m => new Date(m.date) >= new Date(dateStart));
    }
    
    if (dateEnd) {
       const end = new Date(dateEnd);
       end.setHours(23, 59, 59);
       result = result.filter(m => new Date(m.date) <= end);
    }

    setFilteredMovements(result);
  }, [search, typeFilter, dateStart, dateEnd, movements]);

  // Access Control Check for Page Content (Double check aside from Nav)
  if (!loading && currentUser && currentUser.role === UserRole.OPERATOR) {
    return (
       <div className="flex flex-col items-center justify-center h-96 text-slate-400">
         <Lock size={64} className="mb-4 opacity-20" />
         <h2 className="text-2xl font-bold text-slate-600">Acesso Restrito</h2>
         <p>Operadores não têm permissão para visualizar relatórios.</p>
       </div>
    );
  }

  const handleReverse = async (movementId: string) => {
    if (!window.confirm('Deseja realmente estornar esta saída? O saldo voltará para o estoque.')) return;
    
    setProcessingId(movementId);
    const success = await inventoryService.reverseMovement(movementId, 'admin@sys.com');
    
    if (success) {
      await loadData(); // Reload to show new REVERSAL movement and updated status
      alert('Estorno realizado com sucesso.');
    } else {
      alert('Erro ao realizar estorno.');
    }
    setProcessingId(null);
  };

  // Can user reverse? (Admin or Manager)
  const canUserReverse = currentUser && (currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.MANAGER);

  const activeMovements = filteredMovements.filter(m => m.type !== MovementType.REVERSAL && !m.isReversed);
  const totalEntry = activeMovements.filter(m => m.type === MovementType.ENTRY).reduce((acc, m) => acc + m.value, 0);
  const totalExit = activeMovements.filter(m => m.type === MovementType.EXIT).reduce((acc, m) => acc + m.value, 0);

  return (
    <div className="space-y-6">
      {/* Print Header - Visible only on print */}
      <div className="hidden print:block mb-8 text-center border-b-2 border-slate-800 pb-4">
        <h1 className="font-bold text-xl text-slate-900 uppercase tracking-wide">Diretoria de Tecnologia da Informação e Comunicação</h1>
        <h2 className="font-bold text-lg text-slate-900 uppercase tracking-wide">Relatório de Movimentações de Estoque</h2>
        <div className="mt-4 flex justify-between items-end text-sm text-slate-600">
          <div className="text-left">
            <p><strong>Gerado em:</strong> {new Date().toLocaleString('pt-BR')}</p>
            <p><strong>Filtro de Tipo:</strong> {typeFilter === 'ALL' ? 'Todos' : typeFilter}</p>
            {(dateStart || dateEnd) && <p><strong>Período:</strong> {dateStart || 'Início'} até {dateEnd || 'Hoje'}</p>}
          </div>
          <div className="text-right">
            <p>Total Entradas (Ativas): <strong>R$ {totalEntry.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></p>
            <p>Total Saídas (Ativas): <strong>R$ {totalExit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></p>
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center print:hidden">
        <div>
          <h2 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
            <FileText className="text-indigo-600" /> Relatório de Movimentações
          </h2>
          <p className="text-slate-500 mt-2">Histórico completo de auditoria de entradas e saídas.</p>
        </div>
        <button 
          onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-all shadow-sm"
        >
          <Printer size={18} /> Imprimir / PDF
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 print:hidden">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
           <div>
             <p className="text-slate-500 text-xs font-bold uppercase">Total Entradas (Efetivas)</p>
             <p className="text-2xl font-bold text-emerald-600">R$ {totalEntry.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
           </div>
           <ArrowDownCircle className="text-emerald-100 fill-emerald-500 h-10 w-10" />
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
           <div>
             <p className="text-slate-500 text-xs font-bold uppercase">Total Saídas (Efetivas)</p>
             <p className="text-2xl font-bold text-orange-600">R$ {totalExit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
           </div>
           <ArrowUpCircle className="text-orange-100 fill-orange-500 h-10 w-10" />
        </div>
        <div className="bg-slate-800 text-white p-4 rounded-xl border border-slate-700 shadow-sm flex items-center justify-between">
           <div>
             <p className="text-slate-400 text-xs font-bold uppercase">Registros</p>
             <p className="text-2xl font-bold">{filteredMovements.length}</p>
           </div>
           <FileText className="text-slate-600 h-10 w-10" />
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 print:hidden">
        <div className="flex flex-col md:flex-row gap-4 items-end md:items-center">
          <div className="flex-1 w-full">
            <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Busca</label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
              <input 
                type="text" 
                className="w-full pl-10 p-2 bg-slate-50 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Buscar produto, NE ou obs..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>
          
          <div>
             <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Tipo</label>
             <select 
                className="w-full md:w-40 p-2 bg-slate-50 border border-slate-300 rounded-lg outline-none"
                value={typeFilter}
                onChange={e => setTypeFilter(e.target.value as any)}
             >
               <option value="ALL">Todos</option>
               <option value={MovementType.ENTRY}>Entradas</option>
               <option value={MovementType.EXIT}>Saídas</option>
               <option value={MovementType.REVERSAL}>Estornos</option>
             </select>
          </div>

          <div>
             <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Data Início</label>
             <input 
               type="date" 
               className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg outline-none"
               value={dateStart}
               onChange={e => setDateStart(e.target.value)}
             />
          </div>
          
          <div>
             <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Data Fim</label>
             <input 
               type="date" 
               className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg outline-none"
               value={dateEnd}
               onChange={e => setDateEnd(e.target.value)}
             />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden print:shadow-none print:border-none">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm print:text-xs">
            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200 print:bg-slate-100 print:text-black">
              <tr>
                <th className="p-4 print:p-2">Data / Hora</th>
                <th className="p-4 text-center print:p-2">Tipo</th>
                <th className="p-4 print:p-2">NE Ref.</th>
                <th className="p-4 print:p-2">Produto</th>
                <th className="p-4 text-right print:p-2">Qtd</th>
                <th className="p-4 text-right print:p-2">Valor Total</th>
                <th className="p-4 print:p-2">Usuário / Obs</th>
                {canUserReverse && <th className="p-4 text-center print:hidden">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 print:divide-slate-200">
              {loading ? (
                 <tr><td colSpan={8} className="p-8 text-center">Carregando...</td></tr>
              ) : filteredMovements.length === 0 ? (
                 <tr><td colSpan={8} className="p-8 text-center text-slate-400">Nenhum registro encontrado para os filtros selecionados.</td></tr>
              ) : (
                filteredMovements.map((m) => {
                  const isReversed = m.isReversed;
                  const isReversalRecord = m.type === MovementType.REVERSAL;
                  
                  return (
                    <tr key={m.id} className={`transition-colors print:hover:bg-transparent ${isReversed ? 'bg-slate-50 opacity-60' : 'hover:bg-slate-50'}`}>
                      <td className="p-4 text-slate-600 whitespace-nowrap print:p-2">
                        {new Date(m.date).toLocaleDateString('pt-BR')} <span className="text-xs text-slate-400 print:hidden">{new Date(m.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                      </td>
                      <td className="p-4 text-center print:p-2">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                          m.type === MovementType.ENTRY 
                            ? 'bg-emerald-100 text-emerald-700' 
                            : m.type === MovementType.EXIT
                            ? 'bg-orange-100 text-orange-700'
                            : 'bg-slate-200 text-slate-600'
                        } print:border print:border-slate-300 print:bg-transparent print:text-black`}>
                          {m.type}
                        </span>
                      </td>
                      <td className={`p-4 font-mono text-slate-600 print:p-2 ${isReversed ? 'line-through' : ''}`}>{m.neId}</td>
                      <td className={`p-4 font-medium text-slate-800 print:p-2 ${isReversed ? 'line-through' : ''}`}>{m.productName}</td>
                      <td className={`p-4 text-right font-bold print:p-2 ${isReversed ? 'line-through' : ''}`}>{m.quantity}</td>
                      <td className={`p-4 text-right text-slate-600 print:p-2 ${isReversed ? 'line-through' : ''}`}>R$ {m.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                      <td className="p-4 max-w-xs truncate print:p-2 print:whitespace-normal print:max-w-none">
                        <div className="text-slate-800 print:text-xs">{m.userEmail.split('@')[0]}</div>
                        <div className="text-slate-400 text-xs italic truncate print:text-slate-600 print:whitespace-normal" title={m.observation}>
                           {m.observation}
                           {isReversed && <span className="text-red-500 font-bold not-italic ml-1">(ESTORNADO)</span>}
                        </div>
                      </td>
                      {canUserReverse && (
                        <td className="p-4 text-center print:hidden">
                          {m.type === MovementType.EXIT && !isReversed && !isReversalRecord && (
                            <button 
                              onClick={() => handleReverse(m.id)}
                              disabled={processingId === m.id}
                              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                              title="Estornar Saída (Devolver ao Estoque)"
                            >
                              {processingId === m.id ? <RefreshCw size={16} className="animate-spin" /> : <RotateCcw size={16} />}
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Print Footer */}
      <div className="hidden print:block text-center text-[10px] text-slate-400 mt-8 pt-4 border-t border-slate-200">
        <p>Sistema de Controle Patrimonial - Impresso em {new Date().toLocaleString('pt-BR')}</p>
      </div>
    </div>
  );
};

export default Reports;