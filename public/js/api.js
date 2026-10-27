/**
 * Clean & Simple NoSQL Retail API Client
 * Connects directly to Express endpoints without mandatory auth blockers
 */
const API = {
  baseUrl: '/api',

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    const token = localStorage.getItem('retail_token');
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
        throw new Error(data.message || `Server error: ${response.status}`);
      }
      return data;
    } catch (err) {
      console.warn(`API call to ${endpoint}:`, err.message);
      throw err;
    }
  },

  // 1. Database Health & Summary
  async getHealth() {
    return this.request('/health');
  },

  async getKpis() {
    return this.request('/analytics/kpis');
  },

  // 2. Aggregation Pipelines
  async getCategoryPerformance() {
    return this.request('/analytics/category-performance');
  },

  async getSalesByYearMonth() {
    return this.request('/analytics/sales-by-year-month');
  },

  async getTopCustomers(limit = 5) {
    return this.request(`/analytics/top-customers?limit=${limit}`);
  },

  async getShippingTime() {
    return this.request('/analytics/shipping-time');
  },

  async getSalesBySegment() {
    return this.request('/analytics/sales-by-segment');
  },

  async getProfitByGeography() {
    return this.request('/analytics/profit-by-geography');
  },

  // 3. CRUD Operations on Products
  async getProducts(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/products?${query}`);
  },

  async createProduct(productData) {
    return this.request('/products', {
      method: 'POST',
      body: JSON.stringify(productData)
    });
  },

  async updateProduct(id, productData) {
    return this.request(`/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(productData)
    });
  },

  async deleteProduct(id) {
    return this.request(`/products/${id}`, {
      method: 'DELETE'
    });
  },

  // 4. Customers & Orders Lookups
  async getCustomers(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/customers?${query}`);
  },

  async getOrders(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/orders?${query}`);
  }
};
