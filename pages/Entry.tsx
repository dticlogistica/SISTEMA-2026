import React, { useState, useEffect } from 'react';
import { inventoryService } from '../services/inventoryService';
import { Plus, Trash2, Save, PackagePlus, AlertCircle, CheckCircle, Lock } from 'lucide-react';
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
    inventoryService.getCurrentUser().then(user => {
        setCurrentUser(user);
        setPageLoading(false);
    });
  }, []);

  // Access Control Check
  if (!pageLoading && currentUser && currentUser.role === UserRole.OPERATOR) {
    return (
       <div className="flex flex-col items-center justify-center h-96 text-slate-400">
         <Lock size={64} className="mb-4 opacity-20" />
         <h2 className="text-2xl font-bold text-slate-600">Acesso Restrito</h2>
         <p>Operadores não têm permissão para adicionar novas Notas de Empenho.</p>
       </div>
    );
  }

  const handleAddItem = () => {
    if (!currentItem.name || currentItem.initialQty <= 0 || currentItem.unitValue <= 0) return;
    
    setItemsList(prev => [...prev, currentItem]);
    // Reset current item form but keep some defaults
    setCurrentItem({
      name: '',
      unit: 'UN',
      qtyPerPackage: 1,
      initialQty: 0,
      unitValue: 0,
      minStock: 5
    });
  };

  const handleRemoveItem = (index: number) => {
    setItemsList(prev => prev.filter((_, i) => i !== index));
  };

  const handleSaveNE = async () => {
    if (!neNumber || !supplier || itemsList.length === 0) return;

    setLoading(true);
    const success = await inventoryService.createNotaEmpenho(
      { number: neNumber, supplier, date: neDate },
      itemsList
    );

    if (success) {
      setSuccessMsg(`Nota de Empenho ${neNumber} cadastrada com sucesso!`);
      // Reset Form
      setNeNumber('');
      setSupplier('');
      setItemsList([]);
      setTimeout(() => setSuccessMsg(''), 5000);
    }
    setLoading(false);
  };

  const totalValueNE = itemsList.reduce((acc, item) => acc + (item.initialQty * item.unitValue), 0);

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
          <CheckCircle />
          <span className="font-medium">{successMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: NE Details */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h3 className="font-bold text-lg mb-4 text-slate-700 border-b pb-2">Dados da NE</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Número da NE</label>
                <input 
                  type="text" 
                  placeholder="Ex: 2024NE0015"
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none uppercase"
                  value={neNumber}
                  onChange={e => setNeNumber(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Fornecedor</label>
                <input 
                  type="text" 
                  placeholder="Razão Social"
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  value={supplier}
                  onChange={e => setSupplier(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Data de Emissão</label>
                <input 
                  type="date" 
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  value={neDate}
                  onChange={e => setNeDate(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="bg-slate-800 text-white p-6 rounded-xl shadow-lg">
            <p className="text-sm text-slate-400 mb-1">Valor Total da NE</p>
            <p className="text-3xl font-bold font-mono">R$ {totalValueNE.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            <p className="text-xs text-slate-400 mt-2">{itemsList.length} itens adicionados</p>
            
            <button
              onClick={handleSaveNE}
              disabled={loading || !neNumber || itemsList.length === 0}
              className="mt-6 w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-lg transition-colors flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Salvando...' : <><Save size={18} /> Salvar e Confirmar</>}
            </button>
          </div>
        </div>

        {/* Right Column: Item Entry */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h3 className="font-bold text-lg mb-4 text-slate-700 flex items-center gap-2">
              <Plus size={20} className="text-emerald-600" /> Adicionar Item
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Descrição do Produto</label>
                <input 
                  type="text" 
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  value={currentItem.name}
                  onChange={e => setCurrentItem({...currentItem, name: e.target.value})}
                  placeholder="Ex: Caneta Esferográfica Azul"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Unidade de Medida</label>
                <select 
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg outline-none"
                  value={currentItem.unit}
                  onChange={e => setCurrentItem({...currentItem, unit: e.target.value})}
                >
                  <option value="UN">UN (Unidade)</option>
                  <option value="CX">CX (Caixa)</option>
                  <option value="PCT">PCT (Pacote)</option>
                  <option value="RESMA">RESMA</option>
                  <option value="KG">KG (Quilograma)</option>
                  <option value="L">L (Litro)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Qtd. na Embalagem (Informativo)</label>
                <input 
                  type="number" 
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg outline-none"
                  value={currentItem.qtyPerPackage}
                  onChange={e => setCurrentItem({...currentItem, qtyPerPackage: parseFloat(e.target.value)})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Quantidade Adquirida</label>
                <input 
                  type="number" 
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg outline-none focus:border-emerald-500"
                  value={currentItem.initialQty}
                  onChange={e => setCurrentItem({...currentItem, initialQty: parseFloat(e.target.value)})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Valor Unitário (R$)</label>
                <input 
                  type="number" 
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg outline-none focus:border-emerald-500"
                  value={currentItem.unitValue}
                  onChange={e => setCurrentItem({...currentItem, unitValue: parseFloat(e.target.value)})}
                />
              </div>
               <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Estoque Mínimo (Alerta)</label>
                <input 
                  type="number" 
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg outline-none"
                  value={currentItem.minStock}
                  onChange={e => setCurrentItem({...currentItem, minStock: parseFloat(e.target.value)})}
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button 
                onClick={handleAddItem}
                disabled={!currentItem.name || currentItem.initialQty <= 0}
                className="px-6 py-2 bg-slate-800 text-white font-medium rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50"
              >
                Incluir Item na Lista
              </button>
            </div>
          </div>

          {/* Items Table Preview */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
               <h3 className="font-bold text-slate-700">Itens da Nota Fiscal</h3>
               <span className="text-sm bg-slate-200 px-2 py-1 rounded text-slate-600">{itemsList.length} itens</span>
            </div>
            
            {itemsList.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <PackagePlus size={48} className="mx-auto mb-2 opacity-20" />
                <p>Nenhum item adicionado ainda.</p>
              </div>
            ) : (
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                  <tr>
                    <th className="p-3">Produto</th>
                    <th className="p-3 text-center">Unid.</th>
                    <th className="p-3 text-right">Qtd</th>
                    <th className="p-3 text-right">Vl. Unit.</th>
                    <th className="p-3 text-right">Total</th>
                    <th className="p-3 text-center">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {itemsList.map((item, idx) => (
                    <tr key={idx}>
                      <td className="p-3 text-slate-800 font-medium">{item.name}</td>
                      <td className="p-3 text-center text-slate-500">{item.unit}</td>
                      <td className="p-3 text-right text-slate-800">{item.initialQty}</td>
                      <td className="p-3 text-right text-slate-600">R$ {item.unitValue.toFixed(2)}</td>
                      <td className="p-3 text-right font-bold text-slate-800">R$ {(item.initialQty * item.unitValue).toFixed(2)}</td>
                      <td className="p-3 text-center">
                        <button onClick={() => handleRemoveItem(idx)} className="text-red-400 hover:text-red-600 transition-colors">
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Entry;