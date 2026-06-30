const BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

export const api = {
  // Properties & users
  getProperties: () => request<any[]>('/properties'),
  getUsers: () => request<any[]>('/users'),
  getPropertyUsers: (propertyId: string) => request<any[]>(`/properties/${propertyId}/users`),

  // Stock
  getStock: (propertyId: string) => request<any[]>(`/stock/${propertyId}`),
  getIngredientStock: (propertyId: string, ingredientId: string) =>
    request<any>(`/stock/${propertyId}/${ingredientId}`),
  getStockHistory: (propertyId: string, ingredientId: string) =>
    request<any[]>(`/stock/${propertyId}/${ingredientId}/history`),

  // Ingredients
  getIngredients: (propertyId: string) => request<any[]>(`/ingredients/${propertyId}`),

  // Deliveries
  receiveDelivery: (data: object) => request<any>('/deliveries', { method: 'POST', body: JSON.stringify(data) }),
  getDeliveries: (propertyId: string) => request<any[]>(`/deliveries/${propertyId}`),

  // Issues
  issueStock: (data: object) => request<any>('/issues', { method: 'POST', body: JSON.stringify(data) }),
  getIssues: (propertyId: string) => request<any[]>(`/issues/${propertyId}`),

  // Wastage
  recordWastage: (data: object) => request<any>('/wastage', { method: 'POST', body: JSON.stringify(data) }),
  getWastage: (propertyId: string) => request<any[]>(`/wastage/${propertyId}`),

  // Recipes
  getRecipes: (propertyId: string) => request<any[]>(`/recipes/${propertyId}`),
  getRecipe: (propertyId: string, id: string) => request<any>(`/recipes/${propertyId}/${id}`),
  getMenuItems: (propertyId: string) => request<any[]>(`/recipes/${propertyId}/menu-items/list`),

  // Purchase requests
  getPurchaseRequests: (params?: Record<string, string>) =>
    request<any[]>(`/purchase-requests?${new URLSearchParams(params)}`),
  createPurchaseRequest: (data: object) => request<any>('/purchase-requests', { method: 'POST', body: JSON.stringify(data) }),
  updatePurchaseRequest: (id: string, data: object) => request<any>(`/purchase-requests/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  approvePurchaseRequest: (id: string, status: string) => request<any>(`/purchase-requests/${id}`, { method: 'PUT', body: JSON.stringify({ status }) }),

  // Purchase orders
  getPurchaseOrders: (params?: Record<string, string>) =>
    request<any[]>(`/purchase-orders?${new URLSearchParams(params)}`),
  createPurchaseOrder: (data: object) => request<any>('/purchase-orders', { method: 'POST', body: JSON.stringify(data) }),
  getChainView: () => request<any>('/purchase-orders/chain'),

  // Service logs
  logService: (data: object) => request<any>('/service-logs', { method: 'POST', body: JSON.stringify(data) }),
  getServiceLogs: (propertyId: string) => request<any[]>(`/service-logs/${propertyId}`),

  // POS mock
  posEvent: (data: object) => request<any>('/pos/dish-prepared', { method: 'POST', body: JSON.stringify(data) }),

  // Dashboard & reconciliation
  getDashboard: (propertyId: string, period = 7) => request<any>(`/dashboard/${propertyId}?period=${period}`),
  getReconciliation: (propertyId: string, from?: string, to?: string) => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    return request<any>(`/reconciliation/${propertyId}?${params}`);
  },

  // Ingredients / par levels
  updateParLevel: (propertyId: string, ingredientId: string, parLevel: number, reorderPoint: number) =>
    request<any>(`/ingredients/${propertyId}/${ingredientId}/par-level`, { method: 'PUT', body: JSON.stringify({ parLevel, reorderPoint }) }),

  // Alerts
  getAlerts: (propertyId: string) => request<any[]>(`/alerts/${propertyId}`),
  acknowledgeAlert: (id: string) => request<any>(`/alerts/${id}/acknowledge`, { method: 'PUT' }),
};
