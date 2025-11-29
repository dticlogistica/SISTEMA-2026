
import { Product, NotaEmpenho, Movement, MovementType, DashboardStats, NEStatus, User, UserRole } from '../types';
import { API_URL as DEFAULT_API_URL } from './config';

class InventoryService {
  private cachedUsers: User[] = [];
  private cachedProducts: Product[] = [];
  private cachedMovements: Movement[] = [];
  private cachedNes: NotaEmpenho[] = [];
  
  private dataLoaded = false;
  private fetchPromise: Promise<void> | null = null;
  private listeners: (() => void)[] = [];
  private lastFetchTime = 0;
  
  private readonly CACHE_KEY = 'almoxarifado_data_v1';
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutos

  constructor() {
    this.loadFromLocalStorage();
  }

  // --- EVENT SUBSCRIPTION ---
  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach(l => l());
  }

  // --- CACHE MANAGEMENT ---
  private loadFromLocalStorage() {
    try {
      const stored = localStorage.getItem(this.CACHE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        this.processData(data, false);
        this.dataLoaded = true;
      }
    } catch (e) {
      console.error("Erro ao carregar cache local:", e);
    }
  }

  private saveToLocalStorage(data: any) {
    try {
      localStorage.setItem(this.CACHE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error("Erro ao salvar cache local:", e);
    }
  }

  // --- API HELPERS ---

  public getApiUrl(): string {
    const stored = localStorage.getItem('almoxarifado_api_url');
    if (stored && stored.trim().startsWith('http')) {
      return stored.trim();
    }
    return DEFAULT_API_URL;
  }

  private parseNumber(val: any): number {
    if (val === null || val === undefined || val === '') return 0;
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
      const clean = val.replace(',', '.');
      const num = parseFloat(clean);
      return isNaN(num) ? 0 : num;
    }
    return 0;
  }

  private processData(data: any, notify: boolean = true) {
    this.cachedUsers = (data.users || []).map((u: any) => ({
      ...u,
      active: u.active === true || u.active === "TRUE"
    }));
    
    this.cachedProducts = (data.products || []).map((p: any) => {
      const initialQty = this.parseNumber(p.initialQty);
      const currentBal = this.parseNumber(p.currentBalance);
      const safeBalance = isNaN(currentBal) ? (isNaN(initialQty) ? 0 : initialQty) : currentBal;

      return {
        ...p,
        currentBalance: safeBalance,
        unitValue: this.parseNumber(p.unitValue),
        initialQty: initialQty,
        minStock: this.parseNumber(p.minStock)
      };
    });

    this.cachedMovements = (data.movements || []).map((m: any) => ({
      ...m,
      quantity: this.parseNumber(m.quantity),
      value: this.parseNumber(m.value),
      isReversed: m.isReversed === true || m.isReversed === "TRUE"
    }));

    this.cachedNes = data.nes || [];
    
    if (notify) {
      this.notifyListeners();
    }
  }

  // Força uma atualização vinda do servidor
  public async refreshData(): Promise<void> {
    if (this.fetchPromise) return this.fetchPromise;

    this.fetchPromise = (async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000); // 6 segundos de timeout máximo

      try {
        const url = this.getApiUrl();
        
        if (!url || url.includes('COLE_SUA_URL_AQUI')) {
          console.warn("API URL not configured");
          if (!this.dataLoaded) {
             this.processData({ users: [], products: [], movements: [], nes: [] }, true);
             this.dataLoaded = true;
          }
          clearTimeout(timeoutId);
          return;
        }

        const response = await fetch(`${url}?action=getAll&t=${Date.now()}`, {
          method: 'GET',
          redirect: 'follow',
          credentials: 'omit',
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`Erro HTTP: ${response.status}`);
        }

        const text = await response.text();
        let data;
        
        try {
          data = JSON.parse(text);
        } catch (e) {
          if (text.trim().toLowerCase().startsWith("<!doctype html") || text.includes("<html")) {
               throw new Error("ERRO DE PERMISSÃO: O Google retornou uma página de login.");
          }
          throw new Error("O servidor retornou dados inválidos.");
        }
        
        if (data.error) throw new Error(data.error);

        this.processData(data, true);
        this.saveToLocalStorage(data);
        
        this.dataLoaded = true;
        this.lastFetchTime = Date.now();
        
      } catch (error: any) {
        console.error("Refresh falhou:", error);
        // Se falhar o refresh mas já tivermos dados (mesmo que antigos), mantemos os dados
        if (!this.dataLoaded) {
            // Se nunca carregou nada, inicializa vazio para não quebrar a UI
            this.processData({ users: [], products: [], movements: [], nes: [] }, true);
            this.dataLoaded = true;
        }
      } finally {
        clearTimeout(timeoutId);
        this.fetchPromise = null;
      }
    })();

    return this.fetchPromise;
  }

  private async fetchAllData() {
    if (this.dataLoaded) {
      if (Date.now() - this.lastFetchTime > this.CACHE_TTL) {
        this.refreshData().catch(e => console.warn("Background refresh error:", e));
      }
      return;
    }
    await this.refreshData();
  }

  // --- PERMISSIONS HELPER ---
  // Verifica se o usuário atual tem permissão para uma ação específica antes de chamar o servidor
  private async checkPermissions(action: string): Promise<boolean> {
    const user = await this.getCurrentUser();
    
    // Backdoor admin sempre permitido
    if (user.email === 'admin@resgate') return true;

    // Regras de bloqueio baseadas no Role
    switch(action) {
        case 'saveUser': // Apenas Admin
            return user.role === UserRole.ADMIN;
        case 'createNE': // Admin e Gestor
            return [UserRole.ADMIN, UserRole.MANAGER].includes(user.role);
        case 'distribute': // Todos logados (exceto Visitante que é bloqueado na UI, mas aqui checamos também)
            return [UserRole.ADMIN, UserRole.MANAGER, UserRole.OPERATOR].includes(user.role);
        case 'reverse': // Admin e Gestor
            return [UserRole.ADMIN, UserRole.MANAGER].includes(user.role);
        default:
            return true;
    }
  }

  private async postData(action: string, payload: any): Promise<any> {
    // 1. Verificação de Segurança Local (Defense in Depth)
    const allowed = await this.checkPermissions(action);
    if (!allowed) {
        alert("Acesso Negado: Seu perfil não tem permissão para executar esta ação.");
        return false;
    }

    try {
      const url = this.getApiUrl();
      const targetUrl = `${url}?action=${action}`;

      const response = await fetch(targetUrl, {
        method: 'POST',
        redirect: 'follow',
        credentials: 'omit',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action, payload })
      });
      
      const text = await response.text();
      let result;
      try {
        result = JSON.parse(text);
      } catch (e) {
        alert("Erro de comunicação com o servidor.");
        return false;
      }

      if (result.success) {
        await this.refreshData(); 
        // RETORNA O RESULTADO COMPLETO AGORA, NÃO APENAS TRUE
        return result;
      } else {
        alert(`Erro do Sistema: ${result.error}`);
        return false;
      }
    } catch (error) {
      alert("Erro de rede ao tentar salvar.");
      return false;
    }
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
      try {
          const url = this.getApiUrl();
          if (!url || url.includes('COLE_SUA_URL_AQUI')) return { success: false, message: "URL da API não configurada." };
          
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);

          const start = Date.now();
          const response = await fetch(`${url}?action=getAll&t=${start}`, { 
            method: 'GET', 
            redirect: 'follow', 
            credentials: 'omit',
            signal: controller.signal
          });
          clearTimeout(timeoutId);

          if (!response.ok) return { success: false, message: `Erro HTTP: ${response.status}` };

          const text = await response.text();
          if (text.includes("<html")) return { success: false, message: "ERRO DE PERMISSÃO (HTML Login)." };

          try {
              const json = JSON.parse(text);
              if (json.users) return { success: true, message: `Conectado! Ping: ${Date.now() - start}ms.` };
              return { success: false, message: "JSON inválido." };
          } catch {
               return { success: false, message: "Erro ao ler JSON." };
          }
      } catch (e: any) {
          return { success: false, message: `Erro de rede: ${e.message}` };
      }
  }

  // --- CRYPTO HELPER (PBKDF2) ---
  async hashPassword(password: string): Promise<string> {
    const encoder = new TextEncoder();
    // Gera um Salt fixo (para simplificar, em produção idealmente seria aleatório por usuário)
    // Como estamos usando Google Sheets e migrando, vamos usar um salt fixo de sistema
    const salt = encoder.encode("DTIC_ALMOXARIFADO_SECURE_SALT_2026");
    
    const keyMaterial = await crypto.subtle.importKey(
      "raw", 
      encoder.encode(password), 
      { name: "PBKDF2" }, 
      false, 
      ["deriveBits", "deriveKey"]
    );

    const key = await crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: salt,
        iterations: 100000,
        hash: "SHA-256"
      },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    );

    // Exporta a chave como string Hexadecimal
    const exported = await crypto.subtle.exportKey("raw", key);
    const hashArray = Array.from(new Uint8Array(exported));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  }

  // --- USER MANAGEMENT ---

  async getCurrentUser(): Promise<User> {
    const storedEmail = localStorage.getItem('almoxarifado_user');

    // 1. Se não tem nada no storage, é visitante IMEDIATAMENTE.
    if (!storedEmail) {
        return { email: 'public@guest.com', name: 'Visitante', role: UserRole.GUEST, active: true };
    }

    // 2. PRIORIDADE MÁXIMA: Se for Admin Resgate, retorna IMEDIATAMENTE, ignorando rede.
    if (storedEmail === 'admin@resgate') {
         if (!this.dataLoaded) this.refreshData().catch(console.error);
         return { 
            email: 'admin@resgate', 
            name: 'Admin Resgate', 
            role: UserRole.ADMIN, 
            active: true 
        };
    }
    
    // 3. Fallback: Se os dados ainda não carregaram, retorna Visitante por segurança até carregar
    if (!this.dataLoaded) {
         try {
            this.refreshData(); // Dispara refresh sem await para não travar
         } catch (e) {}
    }
    
    // 4. Valida se o usuário existe no cache
    const found = this.cachedUsers.find(u => u.email === storedEmail && u.active);
    if (found) return found;

    // 5. Se não achou (ou cache vazio), retorna Visitante para não travar a tela
    return { email: 'public@guest.com', name: 'Visitante', role: UserRole.GUEST, active: true };
  }

  async login(email: string, password: string): Promise<boolean> {
    const normalizedEmail = email.toLowerCase().trim();
    
    // 1. BACKDOOR DE RESGATE (Funciona Offline)
    if (normalizedEmail === 'admin' && password === 'admin') {
        this.setCurrentUser({ 
            email: 'admin@resgate', 
            name: 'Admin Resgate', 
            role: UserRole.ADMIN, 
            active: true 
        });
        return true;
    }

    if (!password || password.trim() === '') return false;

    // Força atualização
    try { await this.refreshData(); } catch (e) {}

    const user = this.cachedUsers.find(u => u.email.toLowerCase() === normalizedEmail && u.active);
    
    if (user) {
        const storedPass = (user.password || '').trim();
        if (!storedPass) return false; // Impede login se senha for nula no banco

        // Verifica se a senha armazenada é um Hash PBKDF2 (64 chars hex)
        if (storedPass.length === 64 && /^[0-9a-fA-F]+$/.test(storedPass)) {
            const inputHash = await this.hashPassword(password.trim());
            if (storedPass === inputHash) {
                this.setCurrentUser(user);
                return true;
            }
        } 
        // Fallback: Comparação Texto Puro (Legado)
        else if (storedPass === password.trim()) {
            // Opcional: Migrar senha automaticamente
            // this.changeOwnPassword(password, password); 
            this.setCurrentUser(user);
            return true;
        }
    }
    return false;
  }
  
  async logout(): Promise<void> {
    localStorage.removeItem('almoxarifado_user');
    // Ao fazer logout, forçamos o estado para Visitante
    this.notifyListeners();
  }

  private setCurrentUser(user: User) {
    localStorage.setItem('almoxarifado_user', user.email);
    this.notifyListeners();
  }

  async getUsers(): Promise<User[]> {
    await this.fetchAllData();
    return this.cachedUsers;
  }

  async saveUser(user: User): Promise<boolean> {
    // Este método é usado pelo ADMIN no painel de configurações
    const result = await this.postData('saveUser', user);
    return result && result.success;
  }
  
  async changeOwnPassword(oldPasswordPlain: string, newPasswordPlain: string): Promise<{ success: boolean; message?: string }> {
    const currentUser = await this.getCurrentUser();
    if (currentUser.role === UserRole.GUEST) return { success: false, message: 'Visitantes não podem alterar senha.' };
    
    const userInDb = this.cachedUsers.find(u => u.email === currentUser.email);
    if (!userInDb) return { success: false, message: 'Usuário não encontrado.' };

    const storedPass = (userInDb.password || '').trim();
    const oldPassInput = oldPasswordPlain.trim();
    
    let isOldPasswordCorrect = false;

    if (storedPass.length === 64 && /^[0-9a-fA-F]+$/.test(storedPass)) {
        const oldInputHash = await this.hashPassword(oldPassInput);
        isOldPasswordCorrect = (oldInputHash === storedPass);
    } else {
        isOldPasswordCorrect = (storedPass === oldPassInput);
    }

    if (!isOldPasswordCorrect) {
        return { success: false, message: 'A senha atual está incorreta.' };
    }

    const newHash = await this.hashPassword(newPasswordPlain);

    try {
        const url = this.getApiUrl();
        const targetUrl = `${url}?action=saveUser`;
        
        // Mantém os dados, muda a senha
        const userToUpdate = { ...userInDb, password: newHash };

        const response = await fetch(targetUrl, {
            method: 'POST',
            redirect: 'follow',
            credentials: 'omit',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'saveUser', payload: userToUpdate })
        });
        
        const result = await response.json();
        if (result.success) {
            await this.refreshData();
            return { success: true };
        } else {
            return { success: false, message: result.error || 'Erro ao salvar.' };
        }
    } catch (e) {
        return { success: false, message: 'Erro de conexão.' };
    }
  }

  // --- INVENTORY & DASHBOARD ---

  async getProducts(): Promise<Product[]> {
    await this.fetchAllData();
    return this.cachedProducts;
  }

  async getDashboardStats(): Promise<DashboardStats> {
    await this.fetchAllData();
    const totalValue = this.cachedProducts.reduce((acc, p) => acc + (p.currentBalance * p.unitValue), 0);
    const lowStock = this.cachedProducts.filter(p => p.currentBalance <= p.minStock).length;
    
    // Dados para o Gráfico de Evolução (Mantido no objeto, mas talvez não usado na UI)
    const monthlyData = new Map<string, number>();
    let currentMonthOutflow = 0;
    const now = new Date();
    
    this.cachedMovements
      .filter(m => m.type === MovementType.EXIT && !m.isReversed)
      .forEach(m => {
        const date = new Date(m.date);
        const key = date.toLocaleString('pt-BR', { month: 'short' });
        monthlyData.set(key, (monthlyData.get(key) || 0) + m.value);

        if (date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()) {
          currentMonthOutflow += m.value;
        }
      });

    const monthlyOutflow = Array.from(monthlyData.entries()).map(([month, value]) => ({ month, value }));

    const topProducts = this.cachedProducts
      .map(p => ({ name: p.name, value: p.initialQty - p.currentBalance }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    // Lógica para Itens Críticos (Nova Funcionalidade)
    // Filtra produtos com estoque abaixo ou igual ao mínimo
    // Ordena do menor saldo para o maior (mais crítico primeiro)
    const criticalItems = this.cachedProducts
      .filter(p => p.currentBalance <= p.minStock && p.currentBalance >= 0)
      .sort((a, b) => a.currentBalance - b.currentBalance)
      .slice(0, 5)
      .map(p => ({ name: p.name, balance: p.currentBalance, min: p.minStock, unit: p.unit }));

    return {
      totalValueStock: totalValue,
      totalItems: this.cachedProducts.length,
      lowStockCount: lowStock,
      monthlyOutflow,
      topProducts,
      currentMonthOutflow,
      criticalItems // Retorna a lista de itens críticos
    };
  }

  async getConsolidatedStock(): Promise<{ name: string; totalBalance: number; unit: string }[]> {
    await this.fetchAllData();
    const map = new Map<string, { name: string; totalBalance: number; unit: string }>();

    this.cachedProducts.forEach(p => {
      if (!map.has(p.name)) {
        map.set(p.name, { name: p.name, totalBalance: 0, unit: p.unit });
      }
      const item = map.get(p.name)!;
      item.totalBalance += p.currentBalance;
    });

    return Array.from(map.values()).filter(item => item.totalBalance > 0);
  }

  async calculateDistribution(productName: string, quantityRequested: number): Promise<{ 
    itemsToDeduct: { productId: string; neId: string; qty: number; unitValue: number }[], 
    remainingQty: number 
  }> {
    await this.fetchAllData();
    
    const availableBatches = this.cachedProducts
      .filter(p => p.name === productName && p.currentBalance > 0)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    let qtyToDistribute = quantityRequested;
    const itemsToDeduct = [];

    for (const batch of availableBatches) {
      if (qtyToDistribute <= 0) break;

      const take = Math.min(batch.currentBalance, qtyToDistribute);
      itemsToDeduct.push({
        productId: batch.id,
        neId: batch.neId,
        qty: take,
        unitValue: batch.unitValue
      });

      qtyToDistribute -= take;
    }

    return {
      itemsToDeduct,
      remainingQty: qtyToDistribute 
    };
  }

  async executeDistribution(movementsAllocated: { productId: string; neId: string; qty: number; unitValue: number }[], userEmail: string, obs: string): Promise<{ success: boolean, receiptId?: string }> {
    const timestamp = new Date().toISOString();
    
    const movementsData = movementsAllocated.map(m => {
      const product = this.cachedProducts.find(p => p.id === m.productId);
      return {
        id: `MOV-${Math.floor(Math.random() * 100000)}`,
        date: timestamp,
        type: MovementType.EXIT,
        neId: m.neId,
        productId: m.productId,
        productName: product ? product.name : 'Unknown',
        quantity: m.qty,
        value: m.qty * m.unitValue,
        userEmail,
        observation: obs,
        isReversed: false
      };
    });

    const result = await this.postData('distribute', { movements: movementsData });
    
    // Suporte para backend antigo (apenas boolean) ou novo (objeto completo)
    if (typeof result === 'boolean') {
       return { success: result };
    }
    return { success: result.success, receiptId: result.receiptId };
  }

  async reverseMovement(movementId: string, userEmail: string): Promise<boolean> {
    const movement = this.cachedMovements.find(m => m.id === movementId);
    if (!movement) return false;

    const reversalMovement: Movement = {
      id: `REV-${Math.floor(Math.random() * 100000)}`,
      date: new Date().toISOString(),
      type: MovementType.REVERSAL,
      neId: movement.neId,
      productId: movement.productId,
      productName: movement.productName,
      quantity: movement.quantity,
      value: movement.value,
      userEmail: userEmail,
      observation: `ESTORNO referente à saída: ${movement.id}`,
      isReversed: false
    };

    const result = await this.postData('reverse', { movementId, reversalMovement });
    return result && result.success;
  }

  async createNotaEmpenho(neData: { number: string, supplier: string, date: string }, items: any[]): Promise<boolean> {
    const timestamp = new Date().toISOString();
    const totalValue = items.reduce((acc, item) => acc + (item.initialQty * item.unitValue), 0);
    const newNE: NotaEmpenho = {
      id: neData.number,
      supplier: neData.supplier,
      date: neData.date,
      status: NEStatus.OPEN,
      totalValue: totalValue
    };
    
    // Fetch current user explicitly to avoid undefined error
    const currentUser = await this.getCurrentUser();

    const productsPayload: Product[] = [];
    const movementsPayload: Movement[] = [];

    items.forEach((item, index) => {
      const productId = `P-${Date.now()}-${index}`;
      const newProduct: Product = {
        id: productId,
        neId: neData.number,
        name: item.name,
        unit: item.unit,
        qtyPerPackage: item.qtyPerPackage,
        initialQty: item.initialQty,
        unitValue: item.unitValue,
        currentBalance: item.initialQty, 
        minStock: item.minStock,
        createdAt: timestamp
      };
      productsPayload.push(newProduct);

      const newMovement: Movement = {
        id: `MOV-IN-${Date.now()}-${index}`,
        date: timestamp,
        type: MovementType.ENTRY,
        neId: neData.number,
        productId: productId,
        productName: item.name,
        quantity: item.initialQty,
        value: item.initialQty * item.unitValue,
        userEmail: currentUser?.email || 'admin@sys.com',
        observation: 'Entrada Inicial de Nota de Empenho',
        isReversed: false
      };
      movementsPayload.push(newMovement);
    });

    const result = await this.postData('createNE', { 
      ne: newNE, 
      items: productsPayload, 
      movements: movementsPayload 
    });
    return result && result.success;
  }

  async getMovements(): Promise<Movement[]> {
    await this.fetchAllData();
    return this.cachedMovements.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }
}

export const inventoryService = new InventoryService();