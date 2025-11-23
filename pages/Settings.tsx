import React, { useEffect, useState } from 'react';
import { inventoryService } from '../services/inventoryService';
import { User, UserRole } from '../types';
import { Users, UserPlus, Shield, Edit, Trash2, Check, X, HelpCircle, Globe, Github, Server, Activity, Database, Save, Copy, Key, AlertTriangle, Lock, ShieldAlert } from 'lucide-react';

const BACKEND_CODE = `
// ==================================================
// CÓDIGO DO BACKEND (Google Apps Script)
// ==================================================

function doGet(e) { return handleRequest(e); }
function doPost(e) { return handleRequest(e); }

function handleRequest(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(30000);

  try {
    const action = e.parameter.action;
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Payload Parse
    let payload = null;
    try {
      if (e.postData && e.postData.contents) {
        const json = JSON.parse(e.postData.contents);
        if (!action && json.action) {
           if (json.action === 'saveUser') return saveUser(ss, json.payload);
           if (json.action === 'createNE') return createNE(ss, json.payload);
           if (json.action === 'distribute') return distribute(ss, json.payload);
           if (json.action === 'reverse') return reverseMovement(ss, json.payload);
        }
        payload = json.payload;
      }
    } catch (err) {}

    if (action === 'getAll') return createJSONOutput(getAllData(ss));
    if (action === 'saveUser') return saveUser(ss, payload);
    if (action === 'createNE') return createNE(ss, payload);
    if (action === 'distribute') return distribute(ss, payload);
    if (action === 'reverse') return reverseMovement(ss, payload);

    return createJSONOutput({ error: 'Ação desconhecida' });

  } catch (e) {
    return createJSONOutput({ error: e.toString() });
  } finally {
    lock.releaseLock();
  }
}

function createJSONOutput(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function getAllData(ss) {
  return {
    users: sheetToJSON(getOrCreateSheet(ss, 'Users')),
    products: sheetToJSON(getOrCreateSheet(ss, 'Products')),
    movements: sheetToJSON(getOrCreateSheet(ss, 'Movements')),
    nes: sheetToJSON(getOrCreateSheet(ss, 'NotaEmpenho'))
  };
}

function saveUser(ss, user) {
  const sheet = getOrCreateSheet(ss, 'Users');
  const data = sheet.getDataRange().getValues();
  
  let rowIndex = -1;
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === user.email) {
      rowIndex = i + 1;
      break;
    }
  }

  // [email, name, role, active, password]
  const rowData = [user.email, user.name, user.role, user.active, user.password || ''];

  if (rowIndex > 0) {
    // Atualiza
    sheet.getRange(rowIndex, 1, 1, rowData.length).setValues([rowData]);
  } else {
    sheet.appendRow(rowData);
  }
  return createJSONOutput({ success: true });
}

function createNE(ss, payload) {
  const neSheet = getOrCreateSheet(ss, 'NotaEmpenho');
  const prodSheet = getOrCreateSheet(ss, 'Products');
  const movSheet = getOrCreateSheet(ss, 'Movements');

  neSheet.appendRow([payload.ne.id, payload.ne.supplier, payload.ne.date, payload.ne.status, payload.ne.totalValue]);

  const products = payload.items;
  const prodRows = products.map(p => [
    p.id, p.neId, p.name, p.unit, p.qtyPerPackage, 
    p.initialQty, p.unitValue, p.currentBalance, p.minStock, p.createdAt
  ]);
  if (prodRows.length > 0) prodSheet.getRange(prodSheet.getLastRow() + 1, 1, prodRows.length, prodRows[0].length).setValues(prodRows);

  const movements = payload.movements;
  const movRows = movements.map(m => [
    m.id, m.date, m.type, m.neId, m.productId, m.productName, 
    m.quantity, m.value, m.userEmail, m.observation, m.isReversed || false
  ]);
  if (movRows.length > 0) movSheet.getRange(movSheet.getLastRow() + 1, 1, movRows.length, movRows[0].length).setValues(movRows);

  return createJSONOutput({ success: true });
}

function distribute(ss, payload) {
  const prodSheet = getOrCreateSheet(ss, 'Products');
  const movSheet = getOrCreateSheet(ss, 'Movements');
  const movements = payload.movements;

  const movRows = movements.map(m => [
    m.id, m.date, m.type, m.neId, m.productId, m.productName, 
    m.quantity, m.value, m.userEmail, m.observation, false
  ]);
  movSheet.getRange(movSheet.getLastRow() + 1, 1, movRows.length, movRows[0].length).setValues(movRows);

  const prodData = prodSheet.getDataRange().getValues();
  const prodMap = new Map();
  for (let i = 1; i < prodData.length; i++) prodMap.set(prodData[i][0], i + 1);

  movements.forEach(m => {
    const row = prodMap.get(m.productId);
    if (row) {
      const currentBalance = prodSheet.getRange(row, 8).getValue();
      prodSheet.getRange(row, 8).setValue(Number(currentBalance) - Number(m.quantity));
    }
  });

  // LÓGICA DE NUMERAÇÃO SEQUENCIAL DO RECIBO
  const scriptProperties = PropertiesService.getScriptProperties();
  let lastId = Number(scriptProperties.getProperty('LAST_REC_ID')) || 0;
  lastId++;
  scriptProperties.setProperty('LAST_REC_ID', lastId.toString());
  
  const year = new Date().getFullYear();
  const receiptId = "REC-" + ("0000" + lastId).slice(-4) + "/" + year;

  return createJSONOutput({ success: true, receiptId: receiptId });
}

function reverseMovement(ss, payload) {
  const movSheet = getOrCreateSheet(ss, 'Movements');
  const prodSheet = getOrCreateSheet(ss, 'Products');
  
  const originalId = payload.movementId;
  const reversal = payload.reversalMovement;

  const movData = movSheet.getDataRange().getValues();
  for (let i = 1; i < movData.length; i++) {
    if (movData[i][0] === originalId) {
      movSheet.getRange(i + 1, 11).setValue(true); // Mark as reversed
      break;
    }
  }

  const m = reversal;
  movSheet.appendRow([
    m.id, m.date, m.type, m.neId, m.productId, m.productName, 
    m.quantity, m.value, m.userEmail, m.observation, false
  ]);

  const prodData = prodSheet.getDataRange().getValues();
  for (let i = 1; i < prodData.length; i++) {
    if (prodData[i][0] === m.productId) {
      const currentBalance = prodSheet.getRange(i + 1, 8).getValue();
      prodSheet.getRange(i + 1, 8).setValue(Number(currentBalance) + Number(m.quantity));
      break;
    }
  }
  return createJSONOutput({ success: true });
}

function getOrCreateSheet(ss, name) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    if (name === 'Users') sheet.appendRow(['email', 'name', 'role', 'active', 'password']);
    if (name === 'Products') sheet.appendRow(['id', 'neId', 'name', 'unit', 'qtyPerPackage', 'initialQty', 'unitValue', 'currentBalance', 'minStock', 'createdAt']);
    if (name === 'Movements') sheet.appendRow(['id', 'date', 'type', 'neId', 'productId', 'productName', 'quantity', 'value', 'userEmail', 'observation', 'isReversed']);
    if (name === 'NotaEmpenho') sheet.appendRow(['id', 'supplier', 'date', 'status', 'totalValue']);
  }
  return sheet;
}

function sheetToJSON(sheet) {
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const result = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const obj = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = row[j];
    }
    result.push(obj);
  }
  return result;
}
`;

const Settings: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  // Config State
  const [apiUrl, setApiUrl] = useState('');
  const [showBackendCode, setShowBackendCode] = useState(false);
  
  // Modals State
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isDeployModalOpen, setIsDeployModalOpen] = useState(false);
  
  // Connection Test State
  const [connectionStatus, setConnectionStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);
  
  // Form State
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState<User>({
    email: '',
    name: '',
    role: UserRole.OPERATOR,
    active: true,
    password: ''
  });

  const loadUsers = async () => {
    try {
      const data = await inventoryService.getUsers();
      const current = await inventoryService.getCurrentUser();
      setCurrentUser(current);
      setUsers([...data]); 
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
    setApiUrl(inventoryService.getApiUrl());
  }, []);

  const handleSaveUrl = () => {
    if (!apiUrl.trim()) return;
    localStorage.setItem('almoxarifado_api_url', apiUrl.trim());
    alert('URL salva com sucesso! O sistema usará esta conexão agora.');
    setConnectionStatus(null);
    loadUsers();
  };

  const handleOpenUserModal = (user?: User) => {
    if (user) {
      setEditingUser(user);
      setFormData({ ...user, password: user.password || '' });
    } else {
      setEditingUser(null);
      setFormData({ email: '', name: '', role: UserRole.OPERATOR, active: true, password: '' });
    }
    setIsUserModalOpen(true);
  };

  const handleSubmitUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email || !formData.name) return;

    setLoading(true);
    await inventoryService.saveUser(formData);
    await loadUsers();
    setIsUserModalOpen(false);
    setLoading(false);
  };

  const handleDelete = async (email: string) => {
    if (!window.confirm(`Tem certeza que deseja inativar o usuário ${email}?`)) return;
    setLoading(true);
    const user = users.find(u => u.email === email);
    if (user) {
      await inventoryService.saveUser({ ...user, active: false });
    }
    await loadUsers();
    setLoading(false);
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setConnectionStatus(null);
    const result = await inventoryService.testConnection();
    setConnectionStatus(result);
    setTestingConnection(false);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(BACKEND_CODE);
    alert("Código copiado!");
  };

  const isAdmin = currentUser?.role === UserRole.ADMIN;
  // Apenas Admin pode acessar esta página.

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8">
        <div className="bg-red-50 p-6 rounded-full mb-4">
           <ShieldAlert className="w-16 h-16 text-red-600" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800">Acesso Restrito</h2>
        <p className="text-slate-500 mt-2 max-w-md">
          Apenas Administradores têm permissão para acessar as configurações do sistema.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
            <Shield className="text-slate-600" /> Configurações do Sistema
          </h2>
          <p className="text-slate-500 mt-2">Gerenciamento de usuários e sistema.</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setIsDeployModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors font-medium shadow-sm"
          >
            <HelpCircle size={18} /> Como Publicar?
          </button>
        </div>
      </div>

      {/* Painel de Conexão */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
         <h3 className="font-bold text-lg text-slate-700 flex items-center gap-2 mb-4">
            <Database size={20} /> Conexão com Google Sheets
         </h3>
         
         <div className="space-y-4">
             <div>
               <label className="block text-sm font-medium text-slate-700 mb-1">URL do Web App (Script Google)</label>
               <div className="flex gap-2">
                 <input 
                   type="text" 
                   value={apiUrl}
                   onChange={e => setApiUrl(e.target.value)}
                   className="flex-1 p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-accent outline-none font-mono text-sm"
                 />
                 <button onClick={handleSaveUrl} className="px-4 py-2 bg-slate-800 text-white rounded-lg">
                   <Save size={18} />
                 </button>
               </div>
             </div>

             <div className="flex flex-wrap items-center gap-4 pt-2">
                 <button onClick={() => setShowBackendCode(true)} className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg flex items-center gap-2">
                   <Copy size={18} /> Atualizar Backend
                 </button>
                 <button onClick={handleTestConnection} disabled={testingConnection} className="px-4 py-2 bg-sky-600 text-white rounded-lg">
                   {testingConnection ? 'Testando...' : 'Testar Conexão'}
                 </button>
             </div>
             
             {connectionStatus && (
               <div className={`px-4 py-3 rounded-lg border text-sm ${connectionStatus.success ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                 {connectionStatus.message}
               </div>
             )}
         </div>
      </div>

      {/* Lista de Usuários */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div className="flex justify-between items-center mb-6">
           <h3 className="font-bold text-lg text-slate-700 flex items-center gap-2">
             <Users size={20} /> Usuários Cadastrados
           </h3>
           <button 
             onClick={() => handleOpenUserModal()}
             className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg hover:bg-sky-600 transition-colors font-medium shadow-sm"
           >
             <UserPlus size={18} /> Novo Usuário
           </button>
        </div>

        <table className="w-full text-left">
          <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
            <tr>
              <th className="p-4">Nome</th>
              <th className="p-4">E-mail</th>
              <th className="p-4 text-center">Perfil</th>
              <th className="p-4 text-center">Status</th>
              <th className="p-4 text-center">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.length === 0 ? (
               <tr>
                 <td colSpan={5} className="p-8 text-center text-slate-500">
                   Nenhum usuário encontrado. Conecte ao banco de dados ou crie o primeiro usuário.
                 </td>
               </tr>
            ) : (
              users.map(user => (
                <tr key={user.email} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4 font-medium text-slate-800">{user.name}</td>
                  <td className="p-4 text-slate-600 font-mono text-sm">{user.email}</td>
                  <td className="p-4 text-center text-sm font-bold uppercase">{user.role}</td>
                  <td className="p-4 text-center">
                    {user.active ? <Check size={16} className="text-emerald-500 inline"/> : <X size={16} className="text-red-400 inline"/>}
                  </td>
                  <td className="p-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => handleOpenUserModal(user)} className="p-2 text-slate-400 hover:text-accent"><Edit size={16} /></button>
                      {user.email !== 'admin@sys.com' && (
                         <button onClick={() => handleDelete(user.email)} className="p-2 text-slate-400 hover:text-red-500"><Trash2 size={16} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Código Backend */}
      {showBackendCode && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-800 text-white rounded-t-xl">
              <h3 className="font-bold text-lg">Código do Backend (Google Apps Script)</h3>
              <button onClick={() => setShowBackendCode(false)}><X size={20} /></button>
            </div>
            <div className="flex-1 p-0 overflow-hidden relative bg-slate-900">
               <textarea readOnly className="w-full h-full p-4 bg-slate-900 text-green-400 font-mono text-sm resize-none outline-none" value={BACKEND_CODE} />
               <button onClick={handleCopyCode} className="absolute top-4 right-4 bg-white text-slate-900 px-4 py-2 rounded-lg font-bold shadow-lg">Copiar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Usuário */}
      {isUserModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-lg">{editingUser ? 'Editar Usuário' : 'Novo Usuário'}</h3>
              <button onClick={() => setIsUserModalOpen(false)}><X size={20} /></button>
            </div>
            
            <form onSubmit={handleSubmitUser} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nome</label>
                <input 
                  type="text" required
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg outline-none"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">E-mail</label>
                <input 
                  type="email" required
                  disabled={!!editingUser}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg outline-none disabled:opacity-60"
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Senha</label>
                <div className="relative">
                    <Key className="absolute left-3 top-2.5 text-slate-400" size={16} />
                    <input 
                      type="text" 
                      className="w-full pl-10 p-2.5 bg-slate-50 border border-slate-300 rounded-lg outline-none font-mono"
                      placeholder={editingUser ? "Mantenha vazio para não alterar" : "Crie uma senha"}
                      value={formData.password || ''}
                      onChange={e => setFormData({...formData, password: e.target.value})}
                    />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Perfil</label>
                <select 
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg outline-none"
                  value={formData.role}
                  onChange={e => setFormData({...formData, role: e.target.value as UserRole})}
                >
                   <option value={UserRole.ADMIN}>Administrador (Total)</option>
                   <option value={UserRole.MANAGER}>Gestor (Entradas/Saídas)</option>
                   <option value={UserRole.OPERATOR}>Operador</option>
                </select>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <input 
                  type="checkbox" checked={formData.active}
                  onChange={e => setFormData({...formData, active: e.target.checked})}
                  className="w-4 h-4"
                />
                <label className="text-sm text-slate-700">Usuário Ativo</label>
              </div>
              <div className="pt-4 flex gap-3">
                 <button type="button" onClick={() => setIsUserModalOpen(false)} className="flex-1 py-2 border rounded-lg">Cancelar</button>
                 <button type="submit" className="flex-1 py-2 bg-slate-800 text-white rounded-lg font-bold">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* Modal Deploy */}
      {isDeployModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
           <div className="bg-white p-6 rounded-xl max-w-lg">
              <h3 className="font-bold text-lg mb-4">Como Publicar</h3>
              <p className="mb-4 text-sm text-slate-600 leading-relaxed">
                Este sistema utiliza o Google Sheets como banco de dados. <br/><br/>
                1. Copie o código clicando em "Atualizar Backend" &gt; Copiar.<br/>
                2. Vá para o seu Google Sheets &gt; Extensões &gt; Apps Script.<br/>
                3. Cole o código, salve e clique em Implantar &gt; Nova Implantação.<br/>
                4. Selecione tipo "Web App", execute como "Eu" e acesso "Qualquer pessoa".<br/>
                5. Cole a URL gerada no campo acima e clique em Salvar.
              </p>
              <button onClick={() => setIsDeployModalOpen(false)} className="bg-slate-800 text-white px-4 py-2 rounded w-full">Entendi</button>
           </div>
        </div>
      )}
    </div>
  );
};

export default Settings;