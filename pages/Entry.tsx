import React, { useState, useEffect } from 'react';
import { inventoryService } from '../services/inventoryService';
import { Plus, Trash2, Save, PackagePlus, CheckCircle, Info, Lock, ShieldAlert } from 'lucide-react';
import { User, UserRole } from '../types';

interface NewItem {
  name: string;
  unit: string;
  qtyPerPackage: number;
  initialQty: number;
  unitValue: number;
  minStock: number;
}

const Entry: React.FC = () => {
  // User State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [pageLoading, setPageLoading] = useState(true);

  // NE State
  const [neNumber, setNeNumber] = useState('');
  const [supplier, setSupplier] = useState('');
  const [neDate, setNeDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Item Form State
  const [currentItem, setCurrentItem] = useState<NewItem>({
    name: '',
    unit: 'UN',
    qtyPerPackage: 1,
    initialQty: 0,
    unitValue: 0,
    minStock: 5
  });

  const [itemsList, setItemsList] = useState<NewItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    const load = async () => {
       try {
         setCurrentUser(await inventoryService.getCurrentUser());
       } catch (e) {
         console.error(e);
       } finally {
         setPageLoading(false);
       }
    };
    load();
  }, []);

  // PERMISSÕES:
  // Apenas ADMIN e MANAGER podem acessar esta página.
  // OPERATOR e GUEST são bloqueados.
  const hasAccess = currentUser && (currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.MANAGER);

  const handleAddItem = () => {
    if (!currentItem.name || currentItem.initialQty <= 0 || currentItem.unitValue <= 0) return;
    setItemsList(prev => [...prev, currentItem]);
    setCurrentItem({
      name: '', unit: 'UN', qtyPerPackage: 1, initialQty: 0, unitValue: 0, minStock: 5
    });
  };

  const handleRemoveItem = (index: number) => {
    setItemsList(prev => prev.filter((_, i) => i !== index));
  };

  const handleSaveNE = async () => {
    if (!neNumber || !supplier || itemsList.length === 0 || !hasAccess) return;
    setLoading(true);
    try {
        const success = await inventoryService.createNotaEmpenho(
          { number: neNumber, supplier, date: neDate },
          itemsList
        );
        if (success) {
          setSuccessMsg(`Nota de Empenho ${neNumber} cadastrada com sucesso!`);
          setNeNumber(''); setSupplier(''); setItemsList([]);
          setTimeout(() => setSuccessMsg(''), 5000);
        }
    } catch(e) { alert('Erro ao salvar.'); } 
    finally { setLoading(false); }
  };

  const totalValueNE = itemsList.reduce((acc, item) => acc + (item.initialQty * item.unitValue), 0);

  if (pageLoading) return <div className="p-8 text-center text-slate-500">Carregando...</div>;

  // Bloqueio de Acesso
  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8">
        <div className="bg-red-50 p-6 rounded-full mb-4">
           <ShieldAlert className="w-16 h-16 text-red-600" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800">Acesso Negado</h2>
        <p className="text-slate-500 mt-2 max-w-md">
          Seu perfil ({currentUser?.role}) não possui permissão para realizar Entradas de Nota de Empenho.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
          <PackagePlus className="text-emerald-600" /> Entrada de Nota de Empenho
        </h2>
        <p className="text-slate-500 mt-2">Cadastro de NE e inclusão de novos materiais ao estoque.</p>
      </div>

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-4 rounded-lg flex items-center gap-3 animate-fade-in">
          <CheckCircle /> <span className="font-medium">{successMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h3 className="font-bold text-lg mb-4 text-slate-700 border-b pb-2">Dados da NE</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Número da NE</label>
                <input type="text" className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg outline-none uppercase disabled:opacity-60 disabled:bg-slate-100" value={neNumber} onChange={e => setNeNumber(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Fornecedor</label>
                <input type="text" className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg outline-none disabled:opacity-60 disabled:bg-slate-100" value={supplier} onChange={e => setSupplier(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Data de Emissão</label>
                <input type="date" className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg outline-none disabled:opacity-60 disabled:bg-slate-100" value={neDate} onChange={e => setNeDate(e.target.value)} />
              </div>
            </div>
          </div>
          <div className="bg-slate-800 text-white p-6 rounded-xl shadow-lg">
            <p className="text-sm text-slate-400 mb-1">Valor Total da NE</p>
            <p className="text-3xl font-bold font-mono">R$ {totalValueNE.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            <p className="text-xs text-slate-400 mt-2">{itemsList.length} itens adicionados</p>
            <button onClick={handleSaveNE} disabled={loading || !neNumber || itemsList.length === 0} className="mt-6 w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-lg flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? 'Salvando...' : <><Save size={18} /> Salvar e Confirmar</>}
            </button>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h3 className="font-bold text-lg mb-4 text-slate-700 flex items-center gap-2"><Plus size={20} className="text-emerald-600" /> Adicionar Item</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Descrição</label>
                <input type="text" className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg outline-none disabled:opacity-60 disabled:bg-slate-100" value={currentItem.name} onChange={e => setCurrentItem({...currentItem, name: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Unidade</label>
                <select className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg outline-none disabled:opacity-60 disabled:bg-slate-100" value={currentItem.unit} onChange={e => setCurrentItem({...currentItem, unit: e.target.value})}>
                  <option value="UN">UN</option><option value="CX">CX</option><option value="PCT">PCT</option><option value="KG">KG</option><option value="L">L</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Qtd (Unidades)</label>
                <input type="number" className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg outline-none disabled:opacity-60 disabled:bg-slate-100" value={currentItem.initialQty} onChange={e => setCurrentItem({...currentItem, initialQty: parseFloat(e.target.value)})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Valor Unit. (R$)</label>
                <input type="number" className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg outline-none disabled:opacity-60 disabled:bg-slate-100" value={currentItem.unitValue} onChange={e => setCurrentItem({...currentItem, unitValue: parseFloat(e.target.value)})} />
              </div>
               <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Estoque Mín.</label>
                <input type="number" className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg outline-none disabled:opacity-60 disabled:bg-slate-100" value={currentItem.minStock} onChange={e => setCurrentItem({...currentItem, minStock: parseFloat(e.target.value)})} />
              </div>
            </div>
            <div className="flex justify-end">
              <button onClick={handleAddItem} disabled={!currentItem.name || currentItem.initialQty <= 0} className="px-6 py-2 bg-slate-800 text-white font-medium rounded-lg hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed">Incluir</button>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
               <h3 className="font-bold text-slate-700">Itens da Nota</h3>
               <span className="text-sm bg-slate-200 px-2 py-1 rounded text-slate-600">{itemsList.length} itens</span>
            </div>
            {itemsList.length > 0 ? (
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                  <tr><th className="p-3">Produto</th><th className="p-3 text-right">Qtd</th><th className="p-3 text-right">Total</th><th className="p-3 text-center">Ação</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {itemsList.map((item, idx) => (
                    <tr key={idx}>
                      <td className="p-3 text-slate-800 font-medium">{item.name}</td>
                      <td className="p-3 text-right">{item.initialQty}</td>
                      <td className="p-3 text-right font-bold">R$ {(item.initialQty * item.unitValue).toFixed(2)}</td>
                      <td className="p-3 text-center"><button onClick={() => handleRemoveItem(idx)} className="text-red-400 hover:text-red-600 disabled:opacity-50"><Trash2 size={16} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <div className="p-8 text-center text-slate-400">Nenhum item.</div>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Entry;