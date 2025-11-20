// Enums
export enum UserRole {
  ADMIN = 'ADMIN',
  MANAGER = 'GESTOR',
  OPERATOR = 'OPERADOR'
}

export enum MovementType {
  ENTRY = 'ENTRADA',
  EXIT = 'SAIDA',
  REVERSAL = 'ESTORNO'
}

export enum NEStatus {
  OPEN = 'ABERTA',
  CLOSED = 'ENCERRADA'
}

// Interfaces
export interface User {
  email: string;
  name: string;
  role: UserRole;
  active: boolean;
}

export interface NotaEmpenho {
  id: string; // numero da NE
  supplier: string;
  date: string;
  status: NEStatus;
  totalValue: number;
}

export interface Product {
  id: string;
  neId: string; // Link to NotaEmpenho
  name: string;
  unit: string;
  qtyPerPackage: number;
  initialQty: number;
  unitValue: number;
  currentBalance: number;
  minStock: number;
  createdAt: string; // Important for FIFO
}

export interface Movement {
  id: string;
  date: string;
  type: MovementType;
  neId: string;
  productId: string;
  productName: string;
  quantity: number;
  value: number; // Total value of movement
  userEmail: string;
  observation?: string;
  receiptUrl?: string;
  isReversed?: boolean;
}

export interface CartItem {
  productId: string;
  productName: string;
  neId: string;
  quantity: number;
  unitValue: number;
  available: number;
}

export interface DashboardStats {
  totalValueStock: number;
  totalItems: number;
  lowStockCount: number;
  monthlyOutflow: { month: string; value: number }[];
  topProducts: { name: string; value: number }[];
}