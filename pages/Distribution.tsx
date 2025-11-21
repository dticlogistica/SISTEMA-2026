import React, { useState, useEffect, useCallback } from 'react';
import { inventoryService } from '../services/inventoryService';
import { AlertCircle, CheckCircle, ShoppingCart, Printer, Trash2, ArrowUpFromLine, Package, User, UserCheck, Layers, Lock, Building2 } from 'lucide-react';
import { UserRole, User as UserType } from '../types';

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
  const [currentUser, setCurrentUser] = useState<UserType | null>(null);
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
       try {
        const user = await inventoryService.getCurrentUser();
        setCurrentUser(user);
        setAvailableProducts(await inventoryService.getConsolidatedStock());
       } catch (e) {
         console.error("Failed to load for distribution:", e);
       } finally {
         setPageLoading(false);
       }
    };
    
    load();
    return inventoryService.subscribe(load);
  }, [success]);

  // Access Control Check
  if (!pageLoading && currentUser && currentUser.role === UserRole.GUEST) {
      return (
         <div className="flex flex-col items-center justify-center h-96 text-slate-400">
           <Lock size={64} className="mb-4 opacity-20" />
           <h2 className="text-2xl font-bold text-slate-600">Área Restrita</h2>
           <p>Você precisa estar logado para realizar distribuições de material.</p>
           <p className="text-sm mt-2 text-slate-500">Use o menu lateral para fazer login.</p>
         </div>
      );
  }

  const currentProductStats = availableProducts.find(p => p.name === selectedProduct);
  const maxAvailable = currentProductStats?.totalBalance || 0;
  const isQuantityValid = quantity > 0 && quantity <= maxAvailable;

  const handleAddToDistribution = useCallback(async () => {
    if (!selectedProduct || quantity <= 0) return;

    setLoading(true);
    try {
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
    } catch (e) {
        alert('Erro ao calcular distribuição. Tente novamente.');
    } finally {
        setLoading(false);
    }
  }, [selectedProduct, quantity]);

  const handleRemoveItem = (index: number) => {
    setCart(prev => prev.filter((_, i) => i !== index));
  };

  const handleFinalize = async () => {
    if (cart.length === 0 || cart.some(c => !c.isPossible)) return;
    
    setLoading(true);
    try {
        const allMovements: { productId: string; neId: string; qty: number; unitValue: number }[] = [];
        cart.forEach(item => {
          item.allocations.forEach(alloc => allMovements.push(alloc));
        });

        const success = await inventoryService.executeDistribution(allMovements, currentUser?.email || 'user@email.com', observation);
        
        if (success) {
          const randomNum = Math.floor(Math.random() * 999) + 1;
          const receiptId = `REC-${randomNum.toString().padStart(4, '0')}/${new Date().getFullYear()}`;

          setReceiptData({
            id: receiptId,
            date: new Date().toLocaleString('pt-BR'),
            items: cart,
            totalValue: allMovements.reduce((sum, m) => sum + (m.qty * m.unitValue), 0),
            obs: observation,
            receiverName,
            distributorName: distributorName || currentUser?.name
          });
          setSuccess(true);
          setCart([]);
          setObservation('');
          setReceiverName('');
          setDistributorName('');
        }
    } catch (e) {
        alert('Falha ao executar distribuição. Verifique sua conexão.');
    } finally {
        setLoading(false);
    }
  };

  // --- TELA DE RECIBO (A4) ---
  if (success && receiptData) {
    return (
      <div className="flex flex-col items-center min-h-screen bg-slate-100 pb-12">
        
        {/* Feedback Header (Visível apenas na tela) */}
        <div className="no-print w-full max-w-4xl mt-8 mb-6 text-center">
          <div className="inline-flex items-center justify-center p-3 bg-emerald-100 rounded-full text-emerald-600 mb-4 shadow-sm">
            <CheckCircle size={32} />
          </div>
          <h2 className="text-2xl font-bold text-slate-800">Distribuição Realizada!</h2>
          <p className="text-slate-600">Imprima o recibo abaixo para arquivamento.</p>
          
          <div className="flex justify-center gap-4 mt-6">
            <button 
              onClick={() => window.print()} 
              className="flex items-center gap-2 px-6 py-3 bg-slate-800 text-white rounded-lg hover:bg-slate-700 shadow-lg transition-all"
            >
              <Printer size={20} /> Imprimir Recibo (A4)
            </button>
            <button 
              onClick={() => { setSuccess(false); setReceiptData(null); }} 
              className="px-6 py-3 border border-slate-300 bg-white rounded-lg hover:bg-slate-50 shadow-sm text-slate-700 font-medium transition-all"
            >
              Nova Distribuição
            </button>
          </div>
        </div>

        {/* A Folha A4 (Container Principal) */}
        <div className="print:A4 bg-white shadow-2xl print:shadow-none w-[210mm] min-h-[297mm] p-[20mm] text-slate-900 box-border relative flex flex-col">
          
          {/* Cabeçalho Institucional */}
          <div className="flex items-center gap-6 border-b-2 border-black pb-6 mb-6">
            <div className="w-20 h-20 flex items-center justify-center border-2 border-black rounded-lg bg-slate-50 print:bg-transparent">
              <Building2 size={40} className="text-black" />
            </div>
            <div className="flex-1">
               <h1 className="text-xl font-bold uppercase leading-tight">Governo do Estado</h1>
               <h2 className="text-lg font-bold uppercase leading-tight">Diretoria de Tecnologia da Informação</h2>
               <h3 className="text-sm font-semibold uppercase mt-1">Seção de Logística e Almoxarifado</h3>
            </div>
            <div className="text-right">
               <div className="border border-black px-3 py-1 rounded">
                 <p className="text-xs font-bold uppercase">Controle Nº</p>
                 <p className="text-lg font-mono font-bold">{receiptData.id}</p>
               </div>
            </div>
          </div>

          {/* Título */}
          <div className="text-center mb-8">
            <h2 className="text-xl font-bold uppercase border bg-slate-100 print:bg-transparent border-black py-2 rounded">
              Recibo de Entrega de Material
            </h2>
          </div>

          {/* Dados da Transação */}
          <div className="grid grid-cols-2 gap-6 mb-8 text-sm">
             <div className="border border-black p-3 rounded relative">
                <span className="absolute -top-2 left-2 bg-white px-1 text-xs font-bold uppercase">Origem / Emissor</span>
                <p><span className="font-semibold">Unidade:</span> Almoxarifado Central</p>
                <p><span className="font-semibold">Responsável:</span> {receiptData.distributorName}</p>
                <p><span className="font-semibold">Data de Emissão:</span> {receiptData.date}</p>
             </div>
             <div className="border border-black p-3 rounded relative">
                <span className="absolute -top-2 left-2 bg-white px-1 text-xs font-bold uppercase">Destinatário / Requisitante</span>
                <p><span className="font-semibold">Nome:</span> {receiptData.receiverName || '___________________________'}</p>
                <p><span className="font-semibold">Destino/Setor:</span> {receiptData.obs || '___________________________'}</p>
                <p><span className="font-semibold">Status:</span> <span className="uppercase">Atendido</span></p>
             </div>
          </div>

          {/* Tabela de Itens */}
          <div className="flex-1">
            <table className="w-full border-collapse border border-black text-sm">
              <thead>
                <tr className="bg-slate-100 print:bg-slate-200 text-black">
                  <th className="border border-black px-2 py-1 w-12 text-center">#</th>
                  <th className="border border-black px-2 py-1 text-left">Descrição do Material</th>
                  <th className="border border-black px-2 py-1 w-24 text-center">Origem (NE)</th>
                  <th className="border border-black px-2 py-1 w-20 text-right">Qtd</th>
                  <th className="border border-black px-2 py-1 w-28 text-right">Vl. Total</th>
                </tr>
              </thead>
              <tbody>
                {receiptData.items.map((item: CartItem, idx: number) => {
                  const totalItemValue = item.allocations.reduce((acc, a) => acc + (a.qty * a.unitValue), 0);
                  const nes = Array.from(new Set(item.allocations.map(a => a.neId))).join(', ');
                  return (
                    <tr key={idx}>
                      <td className="border border-black px-2 py-1 text-center">{idx + 1}</td>
                      <td className="border border-black px-2 py-1 font-semibold">{item.productName}</td>
                      <td className="border border-black px-2 py-1 text-center text-xs">{nes}</td>
                      <td className="border border-black px-2 py-1 text-right font-bold">{item.requestedQty}</td>
                      <td className="border border-black px-2 py-1 text-right">R$ {totalItemValue.toFixed(2)}</td>
                    </tr>
                  );
                })}
                {/* Linhas vazias para preencher visualmente se for pouco item */}
                {Array.from({ length: Math.max(0, 10 - receiptData.items.length) }).map((_, i) => (
                  <tr key={`empty-${i}`}>
                    <td className="border border-black px-2 py-3"></td>
                    <td className="border border-black px-2 py-3"></td>
                    <td className="border border-black px-2 py-3"></td>
                    <td className="border border-black px-2 py-3"></td>
                    <td className="border border-black px-2 py-3"></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 print:bg-slate-200 font-bold">
                   <td colSpan={3} className="border border-black px-2 py-1 text-right uppercase">Total Geral</td>
                   <td className="border border-black px-2 py-1 text-right">{receiptData.items.reduce((acc: number, i: any) => acc + i.requestedQty, 0)}</td>
                   <td className="border border-black px-2 py-1 text-right">R$ {receiptData.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Termo e Assinaturas */}
          <div className="mt-8 border border-black p-4 rounded">
             <p className="text-xs text-justify mb-8 leading-relaxed">
               DECLARO ter recebido os materiais constantes neste documento em perfeitas condições de uso e conservação, assumindo a responsabilidade pela sua guarda e utilização no serviço público, comprometendo-me a comunicar imediatamente qualquer irregularidade.
             </p>

             <div className="flex justify-between gap-8 mt-12 mb-4 px-4">
                <div className="flex-1 text-center">
                   <div className="border-t border-black mb-2"></div>
                   <p className="font-bold uppercase text-sm">{receiptData.distributorName}</p>
                   <p className="text-xs">Almoxarifado / Expedidor</p>
                </div>
                <div className="flex-1 text-center">
                   <div className="border-t border-black mb-2"></div>
                   <p className="font-bold uppercase text-sm">{receiptData.receiverName || '_____________________________'}</p>
                   <p className="text-xs">Recebedor</p>
                </div>
             </div>
          </div>
          
          <div className="mt-4 text-center text-[10px] text-slate-500">
             Sistema DTIC-PRÓ - Emitido em {receiptData.date}
          </div>

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
                    setQuantity(0);
                }}
              >
                <option value="">Selecione...</option>
                {availableProducts.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
              </select>
              
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
    );
  };
  
  export default Distribution;