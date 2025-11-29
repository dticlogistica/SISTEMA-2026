
import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { inventoryService } from '../services/inventoryService';
import { DashboardStats } from '../types';
import { TrendingUp, AlertTriangle, Package, DollarSign, AlertCircle } from 'lucide-react';

const StatCard = ({ title, value, icon, color }: { title: string, value: string, icon: React.ReactNode, color: string }) => (
  <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 flex items-center gap-4 transition-transform hover:scale-[1.02]">
    <div className={`p-3 rounded-lg ${color} text-white shadow-md`}>
      {icon}
    </div>
    <div>
      <p className="text-sm text-slate-500 font-medium">{title}</p>
      <h3 className="text-2xl font-bold text-slate-800">{value}</h3>
    </div>
  </div>
);

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const data = await inventoryService.getDashboardStats();
        setStats(data);
      } catch (error) {
        console.error("Failed to load dashboard:", error);
      } finally {
        setLoading(false);
      }
    };

    loadStats();
    // Inscrever para atualizações (refresh em background)
    return inventoryService.subscribe(loadStats);
  }, []);

  if (loading) return <div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div></div>;
  if (!stats) return <div>Erro ao carregar dados. Verifique a conexão na aba Configurações.</div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-slate-800">Painel de Gestão</h2>
        <p className="text-slate-500">Visão Geral do Almoxarifado DTIC</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Valor em Estoque" 
          value={`R$ ${stats.totalValueStock.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} 
          icon={<DollarSign size={24} />} 
          color="bg-emerald-500" 
        />
        <StatCard 
          title="Itens Críticos" 
          value={stats.lowStockCount.toString()} 
          icon={<AlertTriangle size={24} />} 
          color="bg-red-500" 
        />
        <StatCard 
          title="Total Produtos" 
          value={stats.totalItems.toString()} 
          icon={<Package size={24} />} 
          color="bg-blue-500" 
        />
         <StatCard 
          title="Saídas (Mês)" 
          value={`R$ ${stats.currentMonthOutflow.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} 
          icon={<TrendingUp size={24} />} 
          color="bg-indigo-500" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Critical Items List (Substituindo o Gráfico de Evolução) */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col">
          <h3 className="text-lg font-bold mb-4 text-red-700 flex items-center gap-2">
             <AlertCircle size={20} /> Alertas de Reposição Urgente
          </h3>
          <p className="text-xs text-slate-500 mb-4">Top 5 itens com estoque crítico (menor ou igual ao mínimo)</p>
          
          <div className="flex-1 overflow-auto">
            {stats.criticalItems.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-emerald-600 bg-emerald-50 rounded-lg p-6">
                    <Package size={40} className="mb-2 opacity-50" />
                    <p className="font-medium">Tudo certo! Estoque saudável.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {stats.criticalItems.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center p-3 bg-red-50 border border-red-100 rounded-lg">
                            <div className="flex flex-col">
                                <span className="font-bold text-slate-800 text-sm">{item.name}</span>
                                <span className="text-xs text-red-600 font-medium">Mínimo: {item.min} {item.unit}</span>
                            </div>
                            <div className="text-right">
                                <span className="block text-xl font-bold text-red-700">{item.balance}</span>
                                <span className="text-[10px] uppercase text-slate-500">Saldo Atual</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
          </div>
        </div>

        {/* Top Products */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-lg font-bold mb-4 text-slate-700">Top 5 Produtos Consumidos (Qtd)</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.topProducts} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis type="number" stroke="#64748b" />
                <YAxis dataKey="name" type="category" width={150} stroke="#64748b" style={{ fontSize: '12px' }} />
                <Tooltip cursor={{fill: '#f1f5f9'}} contentStyle={{ borderRadius: '8px' }} />
                <Bar dataKey="value" name="Quantidade" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;