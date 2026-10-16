/**
 * US Retail Store API Client
 * Encapsulates JWT authentication, request headers, error handling, and REST endpoints
 */
const API = {
  baseUrl: '/api',

  getToken() {
    return localStorage.getItem('retail_token') || '';
  },

  setToken(token) {
    localStorage.setItem('retail_token', token);
  },

  getUser() {
    try {
      return JSON.parse(localStorage.getItem('retail_user')) || null;
    } catch {
      return null;
    }
  },

  setUser(user) {
    localStorage.setItem('retail_user', JSON.stringify(user));
  },

  logout() {
    localStorage.removeItem('retail_token');
    localStorage.removeItem('retail_user');
  },

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401 && !endpoint.includes('/auth/login')) {
          this.logout();
        }
        throw new Error(data.message || `Request failed with status ${response.status}`);
      }

      return data;
    } catch (err) {
      console.error(`API Error on [${options.method || 'GET'} ${endpoint}]:`, err.message);
      throw err;
    }
  },

  // Auth Endpoints
  async login(username, password) {
    const res = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    if (res.token) {
      this.setToken(res.token);
      this.setUser(res.user);
    }
    return res;
  },

  async getMe() {
    return this.request('/auth/me');
  },

  // Customer Endpoints
  async getCustomers(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/customers?${query}`);
  },

  async getCustomerById(id) {
    return this.request(`/customers/${id}`);
  },

  async getCustomerOrders(id) {
    return this.request(`/customers/${id}/orders`);
  },

  async createCustomer(data) {
    return this.request('/customers', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async updateCustomer(id, data) {
    return this.request(`/customers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  async deleteCustomer(id) {
    return this.request(`/customers/${id}`, { method: 'DELETE' });
  },

  // Product Endpoints
  async getProducts(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/products?${query}`);
  },

  async getProductCategories() {
    return this.request('/products/categories');
  },

  async createProduct(data) {
    return this.request('/products', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async updateProduct(id, data) {
    return this.request(`/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  async deleteProduct(id) {
    return this.request(`/products/${id}`, { method: 'DELETE' });
  },

  // Order Endpoints
  async getOrders(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/orders?${query}`);
  },

  async getOrderById(id) {
    return this.request(`/orders/${id}`);
  },

  async createOrder(data) {
    return this.request('/orders', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async updateOrderStatus(id, shippingStatus) {
    return this.request(`/orders/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ shippingStatus })
    });
  },

  async deleteOrder(id) {
    return this.request(`/orders/${id}`, { method: 'DELETE' });
  },

  // Inventory
  async getInventory(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/inventory?${query}`);
  },

  // Analytics
  async getKpis() {
    return this.request('/analytics/kpis');
  },

  async getSalesByYearMonth() {
    return this.request('/analytics/sales-by-year-month');
  },

  async getCategoryPerformance() {
    return this.request('/analytics/category-performance');
  },

  async getTopCustomers(limit = 10) {
    return this.request(`/analytics/top-customers?limit=${limit}`);
  },

  async getProductsByProfit(limit = 10) {
    return this.request(`/analytics/products-by-profit?limit=${limit}`);
  },

  async getProfitByGeography() {
    return this.request('/analytics/profit-by-geography');
  },

  async getDiscountImpact() {
    return this.request('/analytics/discount-impact');
  },

  async getShippingTime() {
    return this.request('/analytics/shipping-time');
  },

  async getSalesBySegment() {
    return this.request('/analytics/sales-by-segment');
  }
};
