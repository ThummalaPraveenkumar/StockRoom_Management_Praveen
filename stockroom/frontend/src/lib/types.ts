export interface Property {
  id: string;
  name: string;
}

export interface User {
  id: string;
  name: string;
  role: 'store_keeper' | 'chef' | 'fb_manager' | 'purchase_manager';
  property_id: string | null;
}

export interface Ingredient {
  id: string;
  property_id: string;
  name: string;
  category: string;
  base_unit: string;
  par_level_base_units: number;
  reorder_quantity_base_units: number;
  vendor_name: string | null;
  vendor_lead_time_days: number | null;
  vendor_price_per_base_unit: number | null;
}

export interface StockBalance {
  ingredientId: string;
  propertyId: string;
  name: string;
  category: string;
  baseUnit: string;
  quantityBaseUnits: number;
  parLevelBaseUnits: number;
  reorderQtyBaseUnits: number;
  vendorName: string | null;
  vendorPricePerBaseUnit: number | null;
  status: 'ok' | 'low' | 'critical' | 'breach';
  displayQuantity: string;
  displayPar: string;
}

export interface Alert {
  id: string;
  propertyId: string;
  ingredientId: string;
  ingredientName: string;
  alertType: 'low_stock' | 'breach_par' | 'critical';
  message: string;
  daysUntilStockout: number | null;
  status: 'active' | 'acknowledged' | 'resolved';
  createdAt: string;
}

export interface PurchaseRequest {
  id: string;
  property_id: string;
  propertyName: string;
  ingredient_id: string;
  ingredientName: string;
  base_unit: string;
  requested_quantity_base_units: number;
  approved_quantity_base_units: number | null;
  display_unit: string;
  status: 'pending' | 'approved' | 'adjusted' | 'rejected' | 'ordered';
  raisedByName: string;
  raisedByRole: string;
  approvedByName: string | null;
  notes: string | null;
  created_at: string;
}

export interface Recipe {
  id: string;
  name: string;
  category: string;
  ingredientCount: number;
}

export interface MenuItem {
  id: string;
  name: string;
  category: string;
  selling_price: number;
  recipe_id: string;
  recipeName: string;
}

export interface TransactionRecord {
  id: string;
  ingredientName: string;
  transactionType: string;
  quantityBaseUnits: number;
  referenceId: string | null;
  referenceType: string | null;
  notes: string | null;
  recordedByName: string;
  recordedAt: string;
}

export interface DashboardData {
  propertyId: string;
  period: number;
  foodCostPct: number;
  totalCost: number;
  totalRevenue: number;
  costByCategory: { category: string; totalCost: number }[];
  topConsumed: { name: string; category: string; base_unit: string; totalUsedBase: number; totalCost: number }[];
  wastage: { name: string; base_unit: string; totalWastedBase: number; totalCost: number }[];
  alerts: Alert[];
  pendingApprovals: any[];
  stockSummary: { total: number; ok: number; low: number; critical: number; breach: number };
}
