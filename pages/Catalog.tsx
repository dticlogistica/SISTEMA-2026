
import React, { useEffect, useState } from 'react';
import { inventoryService } from '../services/inventoryService';
import { CatalogItem, UserRole } from '../types';
import { Book, Plus, Search, Trash2, Save, X, ShieldAlert } from 'lucide-react';

const Catalog: React.FC = () => {
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState<UserRole>(UserRole.GUEST);

  const [newItem, setNewItem] = useState<CatalogItem>({ name: '', unit: 'UN', category: '' });

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await inventoryService.getCatalog();
      const user = await inventoryService.getCurrentUser();
      setCurrentUserRole(user.role);
      setCatalog(data.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.name) return;
    setLoading(true);
    const success = await inventoryService.saveCatalogItem(newItem);
    if (success) {
      setIsModalOpen(false);
      setNewItem({ name: '', unit: 'UN', category: '' });
      await loadData();
    } else {
        setLoading(false);
    }
  };

  const handleDelete = async (item: CatalogItem) => {
    if (!window.confirm(`Excluir "${item.name}" do catálogo?`)) return;
    setLoading(true);
    await inventoryService.deleteCatalogItem(item);
    await loadData();
  };

  const filteredCatalog = catalog.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const canEdit = [UserRole.ADMIN, UserRole.MANAGER].includes(currentUserRole);

  if (!canEdit && currentUserRole !== UserRole.GUEST) { 
      // Se quiser bloquear visualização para Operador, descomente. 
      // Mas ver o catálogo pode ser útil.
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
            <Book className="text-purple-600" /> Catálogo de Produtos
          </h2>
          <p className="text-slate-500 mt-2">Padronização de nomes e unidades para entrada de estoque.</p>
        </div>
        {canEdit && (
            <button 
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium shadow-sm"
            >
                <Plus size={18} /> Novo Item
            </button>
        )}
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div className="relative">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
            <input 
                type="text" 
                placeholder="Buscar no catálogo..." 
                className="w-full pl-10 p-2.5 bg-slate-50 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-purple-500"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
            />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left">
            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                <tr>
                    <th className="p-4">Nome Padronizado</th>
                    <th className="p-4 text-center">Unidade</th>
                    <th className="p-4 text-center">Categoria</th>
                    {canEdit && <th className="p-4 text-center">Ações</th>}
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
                {loading ? (
                    <tr><td colSpan={4} className="p-8 text-center text-slate-500">Carregando...</td></tr>
                ) : filteredCatalog.length === 0 ? (
                    <tr><td colSpan={4} className="p-8 text-center text-slate-500">Nenhum item encontrado.</td></tr>
                ) : (
                    filteredCatalog.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                            <td className="p-4 font-medium text-slate-800">{item.name}</td>
                            <td className="p-4 text-center text-slate-600 bg-slate-50 mx-auto rounded text-xs font-mono">{item.unit}</td>
                            <td className="p-4 text-center text-slate-500 text-sm">{item.category}</td>
                            {canEdit && (
                                <td className="p-4 text-center">
                                    <button onClick={() => handleDelete(item)} className="p-2 text-slate-400 hover:text-red-500 transition-colors">
                                        <Trash2 size={18} />
                                    </button>
                                </td>
                            )}
                        </tr>
                    ))
                )}
            </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h3 className="font-bold text-lg text-slate-800">Novo Item do Catálogo</h3>
                    <button onClick={() => setIsModalOpen(false)}><X size={20} /></button>
                </div>
                <form onSubmit={handleSave} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Nome do Produto</label>
                        <input 
                            type="text" required autoFocus
                            className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-purple-500"
                            placeholder="Ex: Caneta Esferográfica Azul"
                            value={newItem.name}
                            onChange={e => setNewItem({...newItem, name: e.target.value})}
                        />
                        <p className="text-xs text-slate-500 mt-1">Use nomes claros e padronizados.</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Unidade Padrão</label>
                        <select 
                            className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg outline-none"
                            value={newItem.unit}
                            onChange={e => setNewItem({...newItem, unit: e.target.value})}
                        >
                            <option value="UN">UN - Unidade</option>
                            <option value="CX">CX - Caixa</option>
                            <option value="PCT">PCT - Pacote</option>
                            <option value="KG">KG - Quilo</option>
                            <option value="L">L - Litro</option>
                            <option value="M">M - Metro</option>
                            <option value="RESMA">RESMA</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Categoria (Opcional)</label>
                        <input 
                            type="text"
                            className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg outline-none"
                            placeholder="Ex: Escritório, Limpeza"
                            value={newItem.category}
                            onChange={e => setNewItem({...newItem, category: e.target.value})}
                        />
                    </div>
                    <button 
                        type="submit" 
                        disabled={loading}
                        className="w-full py-3 bg-purple-600 text-white font-bold rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center gap-2"
                    >
                        {loading ? 'Salvando...' : <><Save size={18} /> Salvar no Catálogo</>}
                    </button>
                </form>
            </div>
        </div>
      )}
    </div>
  );
};

export default Catalog;
