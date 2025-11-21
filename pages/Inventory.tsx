
import React, { useEffect, useState } from 'react';
import { inventoryService } from '../services/inventoryService';
import { Product } from '../types';
import { Search, Filter, ChevronLeft, ChevronRight } from 'lucide-react';

interface ConsolidatedItem {
  name: string;
  totalQty: number;
  totalValue: number;
  unit: string;
  details: Product[];
}

const Inventory: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'consolidated' | 'detailed'>('consolidated');
  const [loading, setLoading] = useState(true);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  useEffect(() => {
    const load = async () => {
      try {
        setProducts(await inventoryService.getProducts());
      } catch (e) {
        console.error("Failed to load inventory:", e);
      } finally {
        setLoading(false);
      }
    };
    
    load();
    return inventoryService.subscribe(load);
  }, []);

  // Reset pagination when search or view mode changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search, viewMode, itemsPerPage]);

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.neId.toLowerCase().includes(search.toLowerCase())
  );

  // Logic for Consolidated View
  const consolidated = Object.values(filteredProducts.reduce((acc, curr) => {
    if (!acc[curr.name]) {
      acc[curr.name] = {
        name: curr.name,
        totalQty: 0,
        totalValue: 0,
        unit: curr.unit,
        details: []
      };
    }
    acc[curr.name].totalQty += curr.currentBalance;
    acc[curr.name].totalValue += (curr.currentBalance * curr.unitValue);
    acc[curr.name].details.push(curr);
    return acc;
  }, {} as Record<string, ConsolidatedItem>)) as ConsolidatedItem[];

  // Determine current dataset
  const dataToRender = viewMode === 'consolidated' ? consolidated : filteredProducts;
  
  // Pagination Slicing
  const totalPages = Math.ceil(dataToRender.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = dataToRender.slice(startIndex, startIndex + itemsPerPage);

  if (loading) return <div className="p-8 text-center text-slate-500">Carregando estoque...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Estoque Geral</h2>
          <p className="text-slate-500">Consulta de saldos atuais</p>
        </div>
        
        <div className="flex gap-2 bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
          <button 
            onClick={() => setViewMode('consolidated')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'consolidated' ? 'bg-slate-800 text-white shadow' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            Consolidado
          </button>
          <button 
             onClick={() => setViewMode('detailed')}
             className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'detailed' ? 'bg-slate-800 text-white shadow' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            Detalhado (por NE)
          </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex gap-4 items-center sticky top-0 z-10">
        <Search className="text-slate-400" />
        <input 
          type="text" 
          placeholder="Buscar por produto ou NE..." 
          className="flex-1 outline-none bg-transparent text-slate-800 placeholder-slate-400"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <Filter className="text-slate-400 cursor-pointer hover:text-accent" />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="p-4 font-semibold text-slate-600 text-sm">Produto</th>
                {viewMode === 'detailed' && <th className="p-4 font-semibold text-slate-600 text-sm">NE (Origem)</th>}
                <th className="p-4 font-semibold text-slate-600 text-sm text-center">Unidade</th>
                <th className="p-4 font-semibold text-slate-600 text-sm text-right">Saldo Atual</th>
                {viewMode === 'detailed' && <th className="p-4 font-semibold text-slate-600 text-sm text-right">Valor Unit.</th>}
                <th className="p-4 font-semibold text-slate-600 text-sm text-right">Valor Total</th>
                <th className="p-4 font-semibold text-slate-600 text-sm text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {viewMode === 'consolidated' ? (
                (paginatedData as ConsolidatedItem[]).map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 font-medium text-slate-800">{item.name}</td>
                    <td className="p-4 text-center text-slate-500 text-sm">{item.unit}</td>
                    <td className="p-4 text-right font-bold text-slate-700">{item.totalQty}</td>
                    <td className="p-4 text-right text-slate-600">R$ {item.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                    <td className="p-4 text-center">
                      {item.totalQty > 0 
                        ? <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
                        : <span className="inline-block w-2 h-2 rounded-full bg-red-500"></span>
                      }
                    </td>
                  </tr>
                ))
              ) : (
                (paginatedData as Product[]).map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 font-medium text-slate-800">{item.name}</td>
                    <td className="p-4 text-slate-500 text-sm font-mono bg-slate-50 inline-block rounded m-2 px-2 py-1 border border-slate-200">{item.neId}</td>
                    <td className="p-4 text-center text-slate-500 text-sm">{item.unit}</td>
                    <td className={`p-4 text-right font-bold ${item.currentBalance <= item.minStock ? 'text-red-500' : 'text-slate-700'}`}>
                      {item.currentBalance}
                    </td>
                    <td className="p-4 text-right text-slate-500 text-sm">R$ {item.unitValue.toFixed(2)}</td>
                    <td className="p-4 text-right text-slate-600">R$ {(item.currentBalance * item.unitValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                    <td className="p-4 text-center">
                       {item.currentBalance <= item.minStock && item.currentBalance > 0 && (
                         <span className="text-xs text-orange-600 bg-orange-100 px-2 py-1 rounded-full font-medium">Baixo</span>
                       )}
                       {item.currentBalance === 0 && (
                         <span className="text-xs text-red-600 bg-red-100 px-2 py-1 rounded-full font-medium">Zerado</span>
                       )}
                       {item.currentBalance > item.minStock && (
                         <span className="text-xs text-emerald-600 bg-emerald-100 px-2 py-1 rounded-full font-medium">OK</span>
                       )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Controls */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
            <div className="text-sm text-slate-500">
                Exibindo {startIndex + 1} a {Math.min(startIndex + itemsPerPage, dataToRender.length)} de {dataToRender.length} registros
            </div>
            <div className="flex items-center gap-2">
                <div className="mr-4">
                    <select 
                        value={itemsPerPage} 
                        onChange={(e) => { setItemsPerPage(Number(e.target.value)); }}
                        className="bg-white border border-slate-300 rounded px-2 py-1 text-sm outline-none"
                    >
                        <option value={20}>20 por página</option>
                        <option value={50}>50 por página</option>
                        <option value={100}>100 por página</option>
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

export default Inventory;
