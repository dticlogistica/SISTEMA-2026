import React, { useState, useEffect, useCallback } from 'react';
import { inventoryService } from '../services/inventoryService';
import { AlertCircle, CheckCircle, ShoppingCart, Printer, Trash2, ArrowUpFromLine, Package, User, UserCheck, Layers } from 'lucide-react';

interface CartItem {
  productName: string;
  requestedQty: number;
  allocations: { productId: string; neId: string; qty: number; unitValue: number }[];
  isPossible: boolean;
}

interface ProductSummary {
  name: string;
  totalBalance: number;
  unit: string;
}

const Distribution: React.FC = () => {
  const [availableProducts, setAvailableProducts] = useState<ProductSummary[]>([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [quantity, setQuantity] = useState<number>(0);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [observation, setObservation] = useState('');
  const [receiverName, setReceiverName] = useState('');
  const [distributorName, setDistributorName] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [receiptData, setReceiptData] = useState<any>(null); // For printable view

  useEffect(() => {
    // Load products with their consolidated balances
    inventoryService.getConsolidatedStock().then(setAvailableProducts);
  }, [success]); // Reload when a distribution is successful to update stocks

  // Helper to get current selected product stats
  const currentProductStats = availableProducts.find(p => p.name === selectedProduct);
  const maxAvailable = currentProductStats?.totalBalance || 0;
  const isQuantityValid = quantity > 0 && quantity <= maxAvailable;

  const handleAddToDistribution = useCallback(async () => {
    if (!selectedProduct || quantity <= 0) return;

    setLoading(true);
    const result = await inventoryService.calculateDistribution(selectedProduct, quantity);
    
    const newItem: CartItem = {
      productName: selectedProduct,
      requestedQty: quantity,
      allocations: result.itemsToDeduct,
      isPossible: result.remainingQty === 0
    };

    setCart(prev => [...prev, newItem]);
    setQuantity(0);
    setSelectedProduct('');
    setLoading(false);
  }, [selectedProduct, quantity]);

  const handleRemoveItem = (index: number) => {
    setCart(prev => prev.filter((_, i) => i !== index));
  };

  const handleFinalize = async () => {
    if (cart.length === 0 || cart.some(c => !c.isPossible)) return;
    
    setLoading(true);
    
    // Flatten all allocations
    const allMovements: { productId: string; neId: string; qty: number; unitValue: number }[] = [];
    cart.forEach(item => {
      item.allocations.forEach(alloc => allMovements.push(alloc));
    });

    const success = await inventoryService.executeDistribution(allMovements, 'user@email.com', observation);
    
    if (success) {
      // Generate receipt ID in format DTIC - XXX/2026
      const randomNum = Math.floor(Math.random() * 999) + 1;
      const receiptId = `DTIC - ${randomNum.toString().padStart(3, '0')}/2026`;

      setReceiptData({
        id: receiptId,
        date: new Date().toLocaleString('pt-BR'),
        items: cart,
        totalValue: allMovements.reduce((sum, m) => sum + (m.qty * m.unitValue), 0),
        obs: observation,
        receiverName,
        distributorName
      });
      setSuccess(true);
      setCart([]);
      setObservation('');
      setReceiverName('');
      setDistributorName('');
    }
    setLoading(false);
  };

  if (success && receiptData) {
    return (
      <div className="max-w-3xl mx-auto animate-fade-in">
        {/* Feedback Screen Header - Hidden on Print */}
        <div className="text-center mb-6 print:hidden">
          <div className="flex justify-center mb-2">
            <CheckCircle className="text-emerald-500 h-12 w-12" />
          </div>
          <h2 className="text-xl font-bold text-slate-800">Distribuição Confirmada</h2>
        </div>

        {/* The Receipt Paper */}
        <div className="bg-white p-8 rounded-lg shadow-lg border border-slate-200 mb-6 print:shadow-none print:border-none print:p-0">
          
          {/* Institutional Header */}
          <div className="text-center border-b-2 border-slate-800 pb-4 mb-6">
             <h1 className="font-bold text-base text-slate-900 uppercase tracking-wide">Diretoria de Tecnologia da Informação e Comunicação</h1>
             <h2 className="font-bold text-base text-slate-900 uppercase tracking-wide">Seção Logística</h2>
             <h3 className="font-bold text-sm text-slate-700 uppercase mt-1">Sistema de Controle Patrimonial - 2026</h3>
          </div>

          {/* Receipt Metadata */}
          <div className="flex justify-between items-end mb-8 bg-slate-50 p-4 rounded border border-slate-100 print:bg-transparent print:border-none print:p-0">
             <div>
               <span className="block text-xs text-slate-500 uppercase font-semibold">Número do Recibo</span>
               <span className="text-xl font-mono font-bold text-slate-900">{receiptData.id}</span>
             </div>
             <div className="text-right">
               <span className="block text-xs text-slate-500 uppercase font-semibold">Data de Emissão</span>
               <span className="text-base font-mono font-medium text-slate-900">{receiptData.date}</span>
             </div>
          </div>
          
          {/* Table */}
          <div className="mb-8">
            <h4 className="text-sm font-bold text-slate-700 uppercase border-b border-slate-400 mb-2 pb-1">Itens Distribuídos</h4>
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 font-semibold">Produto</th>
                  <th className="py-2 text-right font-semibold">Quantidade</th>
                </tr>
              </thead>
              <tbody>
                {receiptData.items.map((item: CartItem, idx: number) => (
                  <tr key={idx} className="border-b border-slate-100 last:border-0">
                    <td className="py-3 font-medium text-slate-800">{item.productName}</td>
                    <td className="py-3 text-right font-mono text-slate-900">{item.requestedQty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {receiptData.obs && (
            <div className="mb-8 text-sm bg-slate-50 p-3 rounded border border-slate-100 italic text-slate-600 print:bg-transparent print:border-slate-200">
              <span className="font-bold not-italic">Observação/Destino:</span> {receiptData.obs}
            </div>
          )}
          
          {/* Signatures */}
          <div className="mt-16 flex justify-between pt-8 gap-8 print:mt-24">
             <div className="flex flex-col items-center flex-1">
               <div className="border-t border-black w-full max-w-[220px] mb-2"></div>
               <span className="font-bold text-sm uppercase text-center">{receiptData.distributorName || 'Responsável Logística'}</span>
               <span className="text-[10px] text-slate-500 uppercase tracking-wider">Distribuidor</span>
             </div>
             <div className="flex flex-col items-center flex-1">
               <div className="border-t border-black w-full max-w-[220px] mb-2"></div>
               <span className="font-bold text-sm uppercase text-center">{receiptData.receiverName || 'Recebedor'}</span>
               <span className="text-[10px] text-slate-500 uppercase tracking-wider">Assinatura do Recebedor</span>
             </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-center gap-4 print:hidden mb-8">
          <button 
            onClick={() => window.print()} 
            className="flex items-center gap-2 px-6 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 shadow-md transition-all"
          >
            <Printer size={18} /> Imprimir Recibo
          </button>
          <button 
            onClick={() => { setSuccess(false); setReceiptData(null); }} 
            className="px-6 py-2 border border-slate-300 bg-white rounded-lg hover:bg-slate-50 shadow-sm transition-all"
          >
            Nova Distribuição
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <header className="mb-8">
        <h2 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
          <ArrowUpFromLine className="text-accent" /> Distribuição de Material
        </h2>
        <p className="text-slate-500 mt-2">Selecione os produtos para saída. O sistema calculará a baixa automaticamente por ordem de antiguidade (FIFO) das Notas de Empenho.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Selection Form */}
        <div className="lg:col-span-1 bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-fit">
          <h3 className="font-bold text-lg mb-4 text-slate-700">Adicionar Produto</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Produto</label>
              <select 
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-accent outline-none"
                value={selectedProduct}
                onChange={e => {
                    setSelectedProduct(e.target.value);
                    setQuantity(0); // Reset quantity when product changes
                }}
              >
                <option value="">Selecione...</option>
                {availableProducts.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
              </select>
              
              {/* Stock Indicator */}
              {selectedProduct && currentProductStats && (
                <div className="mt-2 flex items-center gap-2 text-sm bg-blue-50 text-blue-700 p-2 rounded border border-blue-100 animate-fade-in">
                   <Layers size={16} />
                   <span>Estoque Disponível: <strong>{currentProductStats.totalBalance} {currentProductStats.unit}</strong></span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Quantidade</label>
              <input 
                type="number" 
                className={`w-full p-2.5 bg-slate-50 border rounded-lg outline-none focus:ring-2 transition-all ${
                    quantity > maxAvailable 
                    ? 'border-red-300 text-red-600 focus:ring-red-200' 
                    : 'border-slate-300 focus:ring-accent'
                }`}
                value={quantity}
                onChange={e => setQuantity(parseInt(e.target.value) || 0)}
                min="0"
                max={maxAvailable}
                disabled={!selectedProduct}
              />
              {quantity > maxAvailable && (
                  <p className="text-xs text-red-500 mt-1 font-medium">Quantidade indisponível em estoque!</p>
              )}
            </div>

            <button 
              onClick={handleAddToDistribution}
              disabled={loading || !selectedProduct || !isQuantityValid}
              className="w-full mt-2 py-2.5 bg-accent text-white font-medium rounded-lg hover:bg-sky-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex justify-center items-center gap-2"
            >
              {loading ? 'Calculando...' : 'Adicionar à Lista'}
            </button>
          </div>
        </div>

        {/* Right: Cart & Preview */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col h-full min-h-[500px]">
          <h3 className="font-bold text-lg mb-4 text-slate-700 flex items-center gap-2">
            <ShoppingCart size={20} /> Itens para Saída
          </h3>

          <div className="flex-1 overflow-y-auto space-y-4">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 border-2 border-dashed border-slate-200 rounded-lg">
                <Package size={48} className="mb-2 opacity-50" />
                <p>Nenhum item selecionado</p>
              </div>
            ) : (
              cart.map((item, idx) => (
                <div key={idx} className={`p-4 rounded-lg border ${item.isPossible ? 'border-slate-200 bg-slate-50' : 'border-red-300 bg-red-50'}`}>
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-bold text-slate-800">{item.productName}</h4>
                      <p className="text-sm text-slate-500">Solicitado: {item.requestedQty} un</p>
                    </div>
                    <button onClick={() => handleRemoveItem(idx)} className="text-slate-400 hover:text-red-500 transition-colors">
                      <Trash2 size={18} />
                    </button>
                  </div>

                  {!item.isPossible ? (
                     <div className="flex items-center gap-2 text-red-600 text-sm mt-2">
                       <AlertCircle size={16} />
                       <span>Estoque insuficiente!</span>
                     </div>
                  ) : (
                    <div className="mt-2 pt-2 border-t border-slate-200">
                      <p className="text-xs font-bold text-slate-500 mb-1 uppercase">Origem do Estoque (FIFO)</p>
                      <ul className="space-y-1">
                        {item.allocations.map((alloc, i) => (
                          <li key={i} className="text-xs flex justify-between text-slate-600 bg-white px-2 py-1 rounded border border-slate-100">
                            <span>NE: <strong>{alloc.neId}</strong></span>
                            <span>Qtd: {alloc.qty}</span>
                            <span>Vl. Unit: R$ {alloc.unitValue.toFixed(2)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          <div className="mt-6 pt-6 border-t border-slate-200">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Distribuidor (Responsável)</label>
                <div className="relative">
                   <UserCheck className="absolute left-3 top-2.5 text-slate-400" size={18} />
                   <input 
                     type="text" 
                     className="w-full pl-10 p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-accent outline-none"
                     placeholder="Seu nome"
                     value={distributorName}
                     onChange={e => setDistributorName(e.target.value)}
                   />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Recebedor</label>
                <div className="relative">
                   <User className="absolute left-3 top-2.5 text-slate-400" size={18} />
                   <input 
                     type="text" 
                     className="w-full pl-10 p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-accent outline-none"
                     placeholder="Quem retira"
                     value={receiverName}
                     onChange={e => setReceiverName(e.target.value)}
                   />
                </div>
              </div>
            </div>

            <label className="block text-sm font-medium text-slate-700 mb-2">Observações / Destino</label>
            <input 
              type="text" 
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg mb-4"
              placeholder="Ex: Setor Financeiro, Para evento X..."
              value={observation}
              onChange={e => setObservation(e.target.value)}
            />
            
            <div className="flex justify-end gap-4">
              <button 
                onClick={() => setCart([])}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Limpar
              </button>
              <button 
                onClick={handleFinalize}
                disabled={loading || cart.length === 0 || cart.some(c => !c.isPossible)}
                className="px-6 py-2 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <CheckCircle size={18} />
                Confirmar Distribuição
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Distribution;