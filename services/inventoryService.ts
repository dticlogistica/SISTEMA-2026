
import { Product, NotaEmpenho, Movement, MovementType, DashboardStats, NEStatus, User, UserRole } from '../types';
import { API_URL as DEFAULT_API_URL } from './config';

class InventoryService {
  private cachedUsers: User[] = [];
  private cachedProducts: Product[] = [];
  private cachedMovements: Movement[] = [];
  private cachedNes: NotaEmpenho[] = [];
  
  private dataLoaded = false;

  // --- API HELPERS ---

  // Helper para pegar a URL correta (prioriza a salva no navegador)
  public getApiUrl(): string {
    const stored = localStorage.getItem('almoxarifado_api_url');
    if (stored && stored.trim().startsWith('http')) {
      return stored.trim();
    }
    return DEFAULT_API_URL;
  }

  private async fetchAllData() {
    if (this.dataLoaded && this.cachedUsers.length > 0) return;

    const url = this.getApiUrl();
    
    if (!url || url.includes('COLE_SUA_URL_AQUI')) {
      console.warn("API URL not configured");
      return;
    }

    try {
      const response = await fetch(`${url}?action=getAll&t=${Date.now()}`, {
        method: 'GET',
        redirect: 'follow',
        credentials: 'omit'
      });
      
      if (!response.ok) {
        throw new Error(`Erro HTTP: ${response.status}`);
      }

      const text = await response.text();
      let data;
      
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error("JSON Parse Error:", text.substring(0, 200));
        if (text.trim().toLowerCase().startsWith("<!doctype html") || text.includes("<html")) {
             throw new Error("ERRO DE PERMISSÃO: O Google retornou uma página de login. Verifique se a Implantação do Web App está como 'Qualquer pessoa' (Anyone).");
        }
        throw new Error("O servidor retornou dados inválidos.");
      }
      
      if (data.error) {
        throw new Error(data.error);
      }

      this.cachedUsers = (data.users || []).map((u: any) => ({
        ...u,
        active: u.active === true || u.active === "TRUE"
      }));
      
      this.cachedProducts = (data.products || []).map((p: any) => ({
        ...p,
        currentBalance: Number(p.currentBalance),
        unitValue: Number(p.unitValue),
        initialQty: Number(p.initialQty),
        minStock: Number(p.minStock)
      }));

      this.cachedMovements = (data.movements || []).map((m: any) => ({
        ...m,
        quantity: Number(m.quantity),
        value: Number(m.value),
        isReversed: m.isReversed === true || m.isReversed === "TRUE"
      }));

      this.cachedNes = data.nes || [];
      this.dataLoaded = true;
    } catch (error) {
      console.error("Erro detalhado no fetchAllData:", error);
      console.warn("Falha na conexão com a planilha. Verifique o console.");
    }
  }

  private async postData(action: string, payload: any): Promise<boolean> {
    try {
      console.log(`Iniciando envio: ${action}`, payload);

      const url = this.getApiUrl();
      const targetUrl = `${url}?action=${action}`;

      const response = await fetch(targetUrl, {
        method: 'POST',
        redirect: 'follow',
        credentials: 'omit',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify({ action, payload })
      });
      
      const text = await response.text();
      console.log("Resposta do servidor (Raw):", text.substring(0, 500));

      let result;
      try {
        result = JSON.parse(text);
      } catch (e) {
        console.error("Erro de Parse JSON. Resposta recebida:", text);
        if (text.includes("<html") || text.includes("<!DOCTYPE")) {
             alert("ERRO DE PERMISSÃO: O sistema não conseguiu salvar pois o Google pediu login. \n\nSOLUÇÃO: No Apps Script, clique em Implantar > Nova Implantação, e em 'Quem pode acessar', selecione 'Qualquer pessoa'.");
        } else {
             alert("Erro de comunicação: O servidor retornou uma resposta inválida. Verifique o console (F12).");
        }
        return false;
      }

      if (result.success) {
        this.dataLoaded = false; 
        console.log("Operação realizada com sucesso!");
        return true;
      } else {
        console.error("API Error (Lógica):", result.error);
        alert(`Erro do Sistema: ${result.error}`);
        return false;
      }
    } catch (error) {
      console.error("Network Error (Catch):", error);
      alert("Erro de rede ao tentar salvar. Verifique sua conexão.");
      return false;
    }
  }

  // Método público para teste de conexão
  async testConnection(): Promise<{ success: boolean; message: string }> {
      try {
          const url = this.getApiUrl();
          if (!url || url.includes('COLE_SUA_URL_AQUI')) return { success: false, message: "URL da API não configurada." };
          
          const start = Date.now();
          
          const response = await fetch(`${url}?action=getAll&t=${start}`, {
            method: 'GET',
            redirect: 'follow',
            credentials: 'omit'
          });
          
          if (!response.ok) {
            return { success: false, message: `Erro HTTP: ${response.status} ${response.statusText}` };
          }

          const text = await response.text();
          
          if (text.includes("<html")) {
              return { success: false, message: "ERRO DE PERMISSÃO: O Google retornou HTML (Login). Mude a permissão do script para 'Qualquer pessoa'." };
          }

          try {
              const json = JSON.parse(text);
              if (json.users) {
                  return { success: true, message: `Conectado! Ping: ${Date.now() - start}ms. Usuários carregados: ${json.users.length}` };
              } else {
                  return { success: false, message: "Conectado, mas o formato do JSON parece incorreto." };
              }
          } catch {
               return { success: false, message: "Erro ao ler JSON. O servidor respondeu, mas não com dados válidos." };
          }

      } catch (e: any) {
          console.error("Erro no Test Connection:", e);
          return { success: false, message: `Erro de rede: ${e.message || 'Failed to fetch'}` };
      }
  }

  // --- USER MANAGEMENT ---

  async getCurrentUser(): Promise<User> {
    await this.fetchAllData();
    
    const storedEmail = localStorage.getItem('almoxarifado_user');
    if (storedEmail) {
      const found = this.cachedUsers.find(u => u.email === storedEmail && u.active);
      if (found) return found;
    }

    const admin = this.cachedUsers.find(u => u.role === UserRole.ADMIN && u.active);
    if (admin) {
      this.setCurrentUser(admin);
      return admin;
    }

    return { email: 'admin@temp.com', name: 'Admin Temporário', role: UserRole.ADMIN, active: true };
  }

  async switchUser(index: number): Promise<User> {
    await this.fetchAllData();
    if (this.cachedUsers.length === 0) return this.getCurrentUser();

    const user = this.cachedUsers[index % this.cachedUsers.length];
    this.setCurrentUser(user);
    return user;
  }

  private setCurrentUser(user: User) {
    localStorage.setItem('almoxarifado_user', user.email);
  }

  async getUsers(): Promise<User[]> {
    await this.fetchAllData();
    return this.cachedUsers;
  }

  async saveUser(user: User): Promise<boolean> {
    const success = await this.postData('saveUser', user);
    if (success) await this.fetchAllData();
    return success;
  }

  async deleteUser(email: string): Promise<boolean> {
    return true; 
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
    
    const monthlyData = new Map<string, number>();
    
    this.cachedMovements
      .filter(m => m.type === MovementType.EXIT && !m.isReversed)
      .forEach(m => {
        const date = new Date(m.date);
        const key = date.toLocaleString('pt-BR', { month: 'short' });
        monthlyData.set(key, (monthlyData.get(key) || 0) + m.value);
      });

    const monthlyOutflow = Array.from(monthlyData.entries()).map(([month, value]) => ({ month, value }));

    const topProducts = this.cachedProducts
      .map(p => ({ name: p.name, value: p.initialQty - p.currentBalance }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    return {
      totalValueStock: totalValue,
      totalItems: this.cachedProducts.length,
      lowStockCount: lowStock,
      monthlyOutflow,
      topProducts
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

  async executeDistribution(movementsAllocated: { productId: string; neId: string; qty: number; unitValue: number }[], userEmail: string, obs: string): Promise<boolean> {
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

    const success = await this.postData('distribute', { movements: movementsData });
    return success;
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

    const success = await this.postData('reverse', { movementId, reversalMovement });
    return success;
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
        userEmail: 'admin@sys.com',
        observation: 'Entrada Inicial de Nota de Empenho',
        isReversed: false
      };
      movementsPayload.push(newMovement);
    });

    const success = await this.postData('createNE', { 
      ne: newNE, 
      items: productsPayload, 
      movements: movementsPayload 
    });

    return success;
  }

  async getMovements(): Promise<Movement[]> {
    await this.fetchAllData();
    return this.cachedMovements.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }
}

export const inventoryService = new InventoryService();
