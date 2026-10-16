/**
 * US Retail Store Management System - UI Controller & Event Handlers
 */
const App = {
  state: {
    currentTab: 'analytics',
    user: null,
    customers: { page: 1, limit: 10, totalPages: 1, search: '', segment: '', state: '' },
    products: { page: 1, limit: 10, totalPages: 1, search: '', category: '', subCategory: '' },
    orders: { page: 1, limit: 10, totalPages: 1, search: '', shippingStatus: '', shipMode: '' },
    inventory: { page: 1, limit: 10, totalPages: 1, search: '', category: '' },
    orderDraftItems: []
  },

  async init() {
    this.bindEvents();
    await this.checkAuth();
    this.switchTab('analytics');
  },

  async checkAuth() {
    const token = API.getToken();
    if (!token) {
      // Auto login as admin for smooth college evaluation demo
      await this.loginWithRole('admin');
      return;
    }

    try {
      const res = await API.getMe();
      this.state.user = res.user;
      this.updateUserUI();
    } catch {
      await this.loginWithRole('admin');
    }
  },

  async loginWithRole(role) {
    const credentials = {
      admin: { username: 'admin', password: 'AdminPassword123!' },
      manager: { username: 'manager', password: 'ManagerPassword123!' },
      cashier: { username: 'cashier', password: 'CashierPassword123!' }
    };

    const creds = credentials[role] || credentials.admin;
    try {
      const res = await API.login(creds.username, creds.password);
      this.state.user = res.user;
      this.updateUserUI();
      this.loadCurrentTabData();
    } catch (err) {
      alert(`Login failed: ${err.message}`);
    }
  },

  updateUserUI() {
    const user = this.state.user;
    if (!user) return;

    document.getElementById('display-username').textContent = user.username;
    const roleBadge = document.getElementById('display-role');
    roleBadge.textContent = user.role;
    roleBadge.className = `user-role role-${user.role}`;

    // Adjust RBAC buttons visibility
    const isAdmin = user.role === 'admin';
    const isManagerOrAdmin = user.role === 'admin' || user.role === 'manager';

    document.querySelectorAll('.rbac-admin-only').forEach((el) => {
      el.style.display = isAdmin ? '' : 'none';
    });

    document.querySelectorAll('.rbac-manager-up').forEach((el) => {
      el.style.display = isManagerOrAdmin ? '' : 'none';
    });
  },

  bindEvents() {
    // Navigation Links
    document.querySelectorAll('.nav-link').forEach((link) => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const tab = link.getAttribute('data-tab');
        this.switchTab(tab);
      });
    });

    // Quick Role Switcher Buttons in Topbar
    document.querySelectorAll('.role-switch-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const role = btn.getAttribute('data-role');
        this.loginWithRole(role);
      });
    });

    // Logout Button
    document.getElementById('btn-logout').addEventListener('click', () => {
      API.logout();
      window.location.reload();
    });

    // Modal Close Buttons
    document.querySelectorAll('.modal-close, .btn-modal-cancel').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.modal-overlay').forEach((m) => m.classList.remove('active'));
      });
    });

    // Filter Bindings
    this.bindFilterEvents();
  },

  bindFilterEvents() {
    // Customers filters
    const custSearch = document.getElementById('cust-search');
    const custSegment = document.getElementById('cust-filter-segment');
    if (custSearch) {
      custSearch.addEventListener('input', this.debounce(() => {
        this.state.customers.search = custSearch.value;
        this.state.customers.page = 1;
        this.loadCustomers();
      }, 300));
    }
    if (custSegment) {
      custSegment.addEventListener('change', () => {
        this.state.customers.segment = custSegment.value;
        this.state.customers.page = 1;
        this.loadCustomers();
      });
    }

    // Products filters
    const prodSearch = document.getElementById('prod-search');
    const prodCategory = document.getElementById('prod-filter-category');
    if (prodSearch) {
      prodSearch.addEventListener('input', this.debounce(() => {
        this.state.products.search = prodSearch.value;
        this.state.products.page = 1;
        this.loadProducts();
      }, 300));
    }
    if (prodCategory) {
      prodCategory.addEventListener('change', () => {
        this.state.products.category = prodCategory.value;
        this.state.products.page = 1;
        this.loadProducts();
      });
    }

    // Orders filters
    const orderSearch = document.getElementById('order-search');
    const orderStatus = document.getElementById('order-filter-status');
    const orderMode = document.getElementById('order-filter-mode');
    if (orderSearch) {
      orderSearch.addEventListener('input', this.debounce(() => {
        this.state.orders.search = orderSearch.value;
        this.state.orders.page = 1;
        this.loadOrders();
      }, 300));
    }
    if (orderStatus) {
      orderStatus.addEventListener('change', () => {
        this.state.orders.shippingStatus = orderStatus.value;
        this.state.orders.page = 1;
        this.loadOrders();
      });
    }
    if (orderMode) {
      orderMode.addEventListener('change', () => {
        this.state.orders.shipMode = orderMode.value;
        this.state.orders.page = 1;
        this.loadOrders();
      });
    }

    // Inventory filters
    const invSearch = document.getElementById('inv-search');
    const invCat = document.getElementById('inv-filter-category');
    if (invSearch) {
      invSearch.addEventListener('input', this.debounce(() => {
        this.state.inventory.search = invSearch.value;
        this.state.inventory.page = 1;
        this.loadInventory();
      }, 300));
    }
    if (invCat) {
      invCat.addEventListener('change', () => {
        this.state.inventory.category = invCat.value;
        this.state.inventory.page = 1;
        this.loadInventory();
      });
    }
  },

  switchTab(tab) {
    this.state.currentTab = tab;

    // Update Sidebar Active state
    document.querySelectorAll('.nav-link').forEach((link) => {
      link.classList.toggle('active', link.getAttribute('data-tab') === tab);
    });

    // Update Main Panels
    document.querySelectorAll('.tab-content').forEach((panel) => {
      panel.classList.toggle('active', panel.id === `tab-${tab}`);
    });

    // Update Titles
    const titles = {
      analytics: { title: 'Store Analytics & Performance', desc: 'Real-time sales, profitability, and operational insights' },
      customers: { title: 'Customer Management', desc: 'Browse, search, edit customer directories and order history' },
      products: { title: 'Product Catalog', desc: 'Inventory items, categories, and SKU listings' },
      orders: { title: 'Order Fulfillment', desc: 'Track, view, and manage customer sales orders' },
      inventory: { title: 'Inventory Sales Volume', desc: 'Aggregated product movement and turnover analysis' }
    };

    const current = titles[tab] || titles.analytics;
    document.getElementById('header-title').textContent = current.title;
    document.getElementById('header-desc').textContent = current.desc;

    this.loadCurrentTabData();
  },

  loadCurrentTabData() {
    switch (this.state.currentTab) {
      case 'analytics':
        this.loadAnalytics();
        break;
      case 'customers':
        this.loadCustomers();
        break;
      case 'products':
        this.loadProducts();
        break;
      case 'orders':
        this.loadOrders();
        break;
      case 'inventory':
        this.loadInventory();
        break;
    }
  },

  // ==========================================
  // TAB 1: ANALYTICS DASHBOARD
  // ==========================================
  async loadAnalytics() {
    // 1. KPI Cards
    try {
      const kpis = await API.getKpis();
      if (kpis && kpis.data) {
        document.getElementById('kpi-sales').textContent = `$${kpis.data.totalSales.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
        document.getElementById('kpi-profit').textContent = `$${kpis.data.totalProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
        document.getElementById('kpi-orders').textContent = kpis.data.totalOrders.toLocaleString();
        document.getElementById('kpi-customers').textContent = kpis.data.totalCustomers.toLocaleString();
      }
    } catch (err) {
      console.error('KPI load error:', err);
    }

    // 2. Charts & Analytics Visualizations
    try {
      const [salesTime, catPerf, segmentSales, geoProfit, discountImpact, shippingTime, topCust, prodProfit] = await Promise.allSettled([
        API.getSalesByYearMonth(),
        API.getCategoryPerformance(),
        API.getSalesBySegment(),
        API.getProfitByGeography(),
        API.getDiscountImpact(),
        API.getShippingTime(),
        API.getTopCustomers(5),
        API.getProductsByProfit(5)
      ]);

      if (salesTime.status === 'fulfilled') DashboardCharts.renderSalesProfitTimeline('chart-sales-profit', salesTime.value?.data || []);
      if (catPerf.status === 'fulfilled') DashboardCharts.renderCategoryPerformance('chart-category', catPerf.value?.data || []);
      if (segmentSales.status === 'fulfilled') DashboardCharts.renderSegmentSales('chart-segment', segmentSales.value?.data || []);
      if (geoProfit.status === 'fulfilled') DashboardCharts.renderRegionalProfit('chart-geography', geoProfit.value?.data || []);
      if (discountImpact.status === 'fulfilled') DashboardCharts.renderDiscountImpact('chart-discount', discountImpact.value?.data || []);
      if (shippingTime.status === 'fulfilled') DashboardCharts.renderShippingTimes('chart-shipping', shippingTime.value?.data || []);

      // 3. Mini Tables (Top Customers & Top Products)
      if (topCust.status === 'fulfilled') this.renderTopCustomersTable(topCust.value?.data || []);
      if (prodProfit.status === 'fulfilled') this.renderTopProductsTable(prodProfit.value?.data?.topProfitable || []);
    } catch (err) {
      console.error('Analytics load error:', err);
    }
  },

  renderTopCustomersTable(customers) {
    const tbody = document.getElementById('tbody-top-customers');
    if (!tbody) return;
    tbody.innerHTML = customers
      .map(
        (c) => `
      <tr>
        <td><strong>${c.customerName}</strong><br><small class="text-muted">${c.customerId}</small></td>
        <td><span class="badge badge-${c.segment.toLowerCase().replace(' ', '')}">${c.segment}</span></td>
        <td>${c.state}</td>
        <td><strong>$${c.totalSales.toLocaleString()}</strong></td>
        <td style="color: ${c.totalProfit >= 0 ? 'var(--success)' : 'var(--danger)'}">$${c.totalProfit.toLocaleString()}</td>
      </tr>`
      )
      .join('');
  },

  renderTopProductsTable(products) {
    const tbody = document.getElementById('tbody-top-products');
    if (!tbody) return;
    tbody.innerHTML = products
      .map(
        (p) => `
      <tr>
        <td><strong>${p.productName}</strong></td>
        <td>${p.totalQuantity} units</td>
        <td>$${p.totalSales.toLocaleString()}</td>
        <td style="color: var(--success); font-weight: 700;">+$${p.totalProfit.toLocaleString()}</td>
      </tr>`
      )
      .join('');
  },

  // ==========================================
  // TAB 2: CUSTOMERS
  // ==========================================
  async loadCustomers() {
    const s = this.state.customers;
    try {
      const res = await API.getCustomers({
        page: s.page,
        limit: s.limit,
        search: s.search,
        segment: s.segment
      });

      s.totalPages = res.totalPages;
      document.getElementById('cust-page-info').textContent = `Page ${res.currentPage} of ${res.totalPages} (${res.total} total)`;
      document.getElementById('cust-btn-prev').disabled = s.page <= 1;
      document.getElementById('cust-btn-next').disabled = s.page >= s.totalPages;

      const tbody = document.getElementById('tbody-customers');
      tbody.innerHTML = res.data
        .map(
          (c) => `
        <tr>
          <td><code>${c.customerId}</code></td>
          <td><strong>${c.name}</strong></td>
          <td><span class="badge badge-${c.segment.toLowerCase().replace(' ', '')}">${c.segment}</span></td>
          <td>${c.address.city}, ${c.address.state} (${c.address.postalCode})</td>
          <td>${c.address.region}</td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="App.viewCustomerOrders('${c.customerId}', '${c.name}')">Orders</button>
            <button class="btn btn-primary btn-sm rbac-manager-up" onclick="App.openEditCustomerModal('${c.customerId}')">Edit</button>
            <button class="btn btn-danger btn-sm rbac-admin-only" onclick="App.deleteCustomer('${c.customerId}')">Delete</button>
          </td>
        </tr>`
        )
        .join('');

      this.updateUserUI();
    } catch (err) {
      alert(`Error loading customers: ${err.message}`);
    }
  },

  async viewCustomerOrders(id, name) {
    try {
      const res = await API.getCustomerOrders(id);
      document.getElementById('modal-cust-orders-title').textContent = `Orders for ${name} (${id})`;
      const tbody = document.getElementById('tbody-modal-cust-orders');
      if (res.data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No orders placed yet.</td></tr>';
      } else {
        tbody.innerHTML = res.data
          .map(
            (o) => `
          <tr>
            <td><code>${o.orderId}</code></td>
            <td>${new Date(o.orderDate).toLocaleDateString()}</td>
            <td>${o.items.length} item(s)</td>
            <td>$${o.totals.sales.toFixed(2)}</td>
            <td><span class="badge badge-${o.shippingStatus.toLowerCase()}">${o.shippingStatus}</span></td>
            <td><button class="btn btn-secondary btn-sm" onclick="App.viewOrderDetails('${o.orderId}')">View</button></td>
          </tr>`
          )
          .join('');
      }
      document.getElementById('modal-cust-orders').classList.add('active');
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  },

  openAddCustomerModal() {
    document.getElementById('form-customer').reset();
    document.getElementById('cust-form-id').readOnly = false;
    document.getElementById('cust-form-id').value = `CU-${Math.floor(10000 + Math.random() * 90000)}`;
    document.getElementById('modal-customer-title').textContent = 'Add New Customer';
    document.getElementById('modal-customer').classList.add('active');
  },

  async openEditCustomerModal(id) {
    try {
      const res = await API.getCustomerById(id);
      const c = res.data;
      document.getElementById('cust-form-id').value = c.customerId;
      document.getElementById('cust-form-id').readOnly = true;
      document.getElementById('cust-form-name').value = c.name;
      document.getElementById('cust-form-segment').value = c.segment;
      document.getElementById('cust-form-city').value = c.address.city;
      document.getElementById('cust-form-state').value = c.address.state;
      document.getElementById('cust-form-zip').value = c.address.postalCode;
      document.getElementById('cust-form-region').value = c.address.region;

      document.getElementById('modal-customer-title').textContent = `Edit Customer: ${c.customerId}`;
      document.getElementById('modal-customer').classList.add('active');
    } catch (err) {
      alert(`Error loading customer: ${err.message}`);
    }
  },

  async saveCustomer(e) {
    e.preventDefault();
    const id = document.getElementById('cust-form-id').value;
    const isEdit = document.getElementById('cust-form-id').readOnly;

    const data = {
      customerId: id,
      name: document.getElementById('cust-form-name').value,
      segment: document.getElementById('cust-form-segment').value,
      address: {
        city: document.getElementById('cust-form-city').value,
        state: document.getElementById('cust-form-state').value,
        postalCode: document.getElementById('cust-form-zip').value,
        region: document.getElementById('cust-form-region').value
      }
    };

    try {
      if (isEdit) {
        await API.updateCustomer(id, data);
      } else {
        await API.createCustomer(data);
      }
      document.getElementById('modal-customer').classList.remove('active');
      this.loadCustomers();
    } catch (err) {
      alert(`Save customer failed: ${err.message}`);
    }
  },

  async deleteCustomer(id) {
    if (!confirm(`Are you sure you want to delete customer '${id}'?`)) return;
    try {
      await API.deleteCustomer(id);
      this.loadCustomers();
    } catch (err) {
      alert(`Deletion blocked: ${err.message}`);
    }
  },

  // ==========================================
  // TAB 3: PRODUCTS
  // ==========================================
  async loadProducts() {
    const s = this.state.products;
    try {
      const res = await API.getProducts({
        page: s.page,
        limit: s.limit,
        search: s.search,
        category: s.category
      });

      s.totalPages = res.totalPages;
      document.getElementById('prod-page-info').textContent = `Page ${res.currentPage} of ${res.totalPages} (${res.total} total)`;
      document.getElementById('prod-btn-prev').disabled = s.page <= 1;
      document.getElementById('prod-btn-next').disabled = s.page >= s.totalPages;

      const tbody = document.getElementById('tbody-products');
      tbody.innerHTML = res.data
        .map(
          (p) => `
        <tr>
          <td><code>${p.productId}</code></td>
          <td><strong>${p.name}</strong></td>
          <td><span class="badge" style="background:#e0f2fe; color:#0369a1;">${p.category}</span></td>
          <td>${p.subCategory}</td>
          <td>
            <button class="btn btn-primary btn-sm rbac-manager-up" onclick="App.openEditProductModal('${p.productId}')">Edit</button>
            <button class="btn btn-danger btn-sm rbac-admin-only" onclick="App.deleteProduct('${p.productId}')">Delete</button>
          </td>
        </tr>`
        )
        .join('');

      this.updateUserUI();
    } catch (err) {
      alert(`Error loading products: ${err.message}`);
    }
  },

  openAddProductModal() {
    document.getElementById('form-product').reset();
    document.getElementById('prod-form-id').readOnly = false;
    document.getElementById('prod-form-id').value = `TEC-PH-${Math.floor(10000000 + Math.random() * 90000000)}`;
    document.getElementById('modal-product-title').textContent = 'Add Catalog Product';
    document.getElementById('modal-product').classList.add('active');
  },

  async openEditProductModal(id) {
    try {
      const res = await API.request(`/products/${id}`);
      const p = res.data;
      document.getElementById('prod-form-id').value = p.productId;
      document.getElementById('prod-form-id').readOnly = true;
      document.getElementById('prod-form-name').value = p.name;
      document.getElementById('prod-form-category').value = p.category;
      document.getElementById('prod-form-subcategory').value = p.subCategory;

      document.getElementById('modal-product-title').textContent = `Edit Product: ${p.productId}`;
      document.getElementById('modal-product').classList.add('active');
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  },

  async saveProduct(e) {
    e.preventDefault();
    const id = document.getElementById('prod-form-id').value;
    const isEdit = document.getElementById('prod-form-id').readOnly;

    const data = {
      productId: id,
      name: document.getElementById('prod-form-name').value,
      category: document.getElementById('prod-form-category').value,
      subCategory: document.getElementById('prod-form-subcategory').value
    };

    try {
      if (isEdit) {
        await API.updateProduct(id, data);
      } else {
        await API.createProduct(data);
      }
      document.getElementById('modal-product').classList.remove('active');
      this.loadProducts();
    } catch (err) {
      alert(`Save product failed: ${err.message}`);
    }
  },

  async deleteProduct(id) {
    if (!confirm(`Are you sure you want to delete product '${id}'?`)) return;
    try {
      await API.deleteProduct(id);
      this.loadProducts();
    } catch (err) {
      alert(`Deletion blocked: ${err.message}`);
    }
  },

  // ==========================================
  // TAB 4: ORDERS
  // ==========================================
  async loadOrders() {
    const s = this.state.orders;
    try {
      const res = await API.getOrders({
        page: s.page,
        limit: s.limit,
        orderId: s.search,
        shippingStatus: s.shippingStatus,
        shipMode: s.shipMode
      });

      s.totalPages = res.totalPages;
      document.getElementById('order-page-info').textContent = `Page ${res.currentPage} of ${res.totalPages} (${res.total} total)`;
      document.getElementById('order-btn-prev').disabled = s.page <= 1;
      document.getElementById('order-btn-next').disabled = s.page >= s.totalPages;

      const tbody = document.getElementById('tbody-orders');
      tbody.innerHTML = res.data
        .map(
          (o) => `
        <tr>
          <td><code>${o.orderId}</code></td>
          <td><strong>${o.customerId}</strong></td>
          <td>${new Date(o.orderDate).toLocaleDateString()}</td>
          <td>${o.shipMode}</td>
          <td>${o.items.length} item(s)</td>
          <td><strong>$${o.totals.sales.toFixed(2)}</strong></td>
          <td style="color: ${o.totals.profit >= 0 ? 'var(--success)' : 'var(--danger)'}">$${o.totals.profit.toFixed(2)}</td>
          <td><span class="badge badge-${o.shippingStatus.toLowerCase()}">${o.shippingStatus}</span></td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="App.viewOrderDetails('${o.orderId}')">Details</button>
            <button class="btn btn-primary btn-sm rbac-manager-up" onclick="App.openUpdateStatusModal('${o.orderId}', '${o.shippingStatus}')">Status</button>
            <button class="btn btn-danger btn-sm rbac-admin-only" onclick="App.deleteOrder('${o.orderId}')">Delete</button>
          </td>
        </tr>`
        )
        .join('');

      this.updateUserUI();
    } catch (err) {
      alert(`Error loading orders: ${err.message}`);
    }
  },

  async viewOrderDetails(id) {
    try {
      const res = await API.getOrderById(id);
      const o = res.data;
      document.getElementById('modal-order-title').textContent = `Order Details: ${o.orderId}`;
      document.getElementById('modal-order-meta').innerHTML = `
        <div style="margin-bottom: 16px; background:#f8fafc; padding:12px; border-radius:6px; font-size:0.85rem;">
          <p><strong>Customer:</strong> ${o.customerDetails?.name || o.customerId} (${o.customerDetails?.segment || 'Retail'})</p>
          <p><strong>Ship To:</strong> ${o.shippingAddress.city}, ${o.shippingAddress.state} ${o.shippingAddress.postalCode} (${o.shippingAddress.region})</p>
          <p><strong>Order Date:</strong> ${new Date(o.orderDate).toLocaleDateString()} | <strong>Ship Date:</strong> ${new Date(o.shipDate).toLocaleDateString()}</p>
          <p><strong>Ship Mode:</strong> ${o.shipMode} | <strong>Status:</strong> <span class="badge badge-${o.shippingStatus.toLowerCase()}">${o.shippingStatus}</span></p>
        </div>`;

      const tbody = document.getElementById('tbody-modal-order-items');
      tbody.innerHTML = o.items
        .map(
          (item) => `
        <tr>
          <td><strong>${item.productName}</strong><br><small class="text-muted">${item.productId}</small></td>
          <td>${item.quantity}</td>
          <td>$${item.sales.toFixed(2)}</td>
          <td>${(item.discount * 100).toFixed(0)}%</td>
          <td style="color: ${item.profit >= 0 ? 'var(--success)' : 'var(--danger)'}">$${item.profit.toFixed(2)}</td>
        </tr>`
        )
        .join('');

      document.getElementById('modal-order-total-sales').textContent = `$${o.totals.sales.toFixed(2)}`;
      document.getElementById('modal-order-total-profit').textContent = `$${o.totals.profit.toFixed(2)}`;

      document.getElementById('modal-order-details').classList.add('active');
    } catch (err) {
      alert(`Error fetching order: ${err.message}`);
    }
  },

  openUpdateStatusModal(id, currentStatus) {
    document.getElementById('status-form-order-id').value = id;
    document.getElementById('status-form-select').value = currentStatus;
    document.getElementById('modal-update-status').classList.add('active');
  },

  async saveOrderStatus(e) {
    e.preventDefault();
    const id = document.getElementById('status-form-order-id').value;
    const status = document.getElementById('status-form-select').value;
    try {
      await API.updateOrderStatus(id, status);
      document.getElementById('modal-update-status').classList.remove('active');
      this.loadOrders();
    } catch (err) {
      alert(`Update status failed: ${err.message}`);
    }
  },

  async deleteOrder(id) {
    if (!confirm(`Are you sure you want to delete order '${id}'?`)) return;
    try {
      await API.deleteOrder(id);
      this.loadOrders();
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    }
  },

  openCreateOrderModal() {
    this.state.orderDraftItems = [
      { productId: 'TEC-AC-10003033', productName: 'Plantronics CS510 - Over-the-Head monaural Wireless Headset System', sales: 341.98, quantity: 2, discount: 0.1, profit: 91.19 }
    ];
    this.renderDraftItems();
    document.getElementById('modal-create-order').classList.add('active');
  },

  renderDraftItems() {
    const tbody = document.getElementById('tbody-draft-items');
    tbody.innerHTML = this.state.orderDraftItems
      .map(
        (it, idx) => `
      <tr>
        <td><input type="text" class="form-control" value="${it.productName}" onchange="App.updateDraftItem(${idx}, 'productName', this.value)"></td>
        <td><input type="number" class="form-control" value="${it.quantity}" min="1" onchange="App.updateDraftItem(${idx}, 'quantity', this.value)"></td>
        <td><input type="number" step="0.01" class="form-control" value="${it.sales}" onchange="App.updateDraftItem(${idx}, 'sales', this.value)"></td>
        <td><input type="number" step="0.01" max="1" min="0" class="form-control" value="${it.discount}" onchange="App.updateDraftItem(${idx}, 'discount', this.value)"></td>
        <td><input type="number" step="0.01" class="form-control" value="${it.profit}" onchange="App.updateDraftItem(${idx}, 'profit', this.value)"></td>
      </tr>`
      )
      .join('');
  },

  updateDraftItem(idx, key, val) {
    this.state.orderDraftItems[idx][key] = ['quantity', 'sales', 'discount', 'profit'].includes(key) ? parseFloat(val) || 0 : val;
  },

  addDraftItem() {
    this.state.orderDraftItems.push({
      productId: 'OFF-PA-10001970',
      productName: 'Xerox 1881 Premium Multipurpose Paper',
      sales: 24.50,
      quantity: 1,
      discount: 0,
      profit: 8.20
    });
    this.renderDraftItems();
  },

  async saveNewOrder(e) {
    e.preventDefault();
    const custId = document.getElementById('new-order-cust-id').value;
    const mode = document.getElementById('new-order-mode').value;

    const payload = {
      customerId: custId,
      orderDate: new Date(),
      shipDate: new Date(Date.now() + 3 * 86400000),
      shipMode: mode,
      shippingAddress: { city: 'New York', state: 'New York', postalCode: '10001', region: 'East' },
      items: this.state.orderDraftItems
    };

    try {
      await API.createOrder(payload);
      document.getElementById('modal-create-order').classList.remove('active');
      this.switchTab('orders');
    } catch (err) {
      alert(`Create order failed: ${err.message}`);
    }
  },

  // ==========================================
  // TAB 5: INVENTORY VIEW
  // ==========================================
  async loadInventory() {
    const s = this.state.inventory;
    try {
      const res = await API.getInventory({
        page: s.page,
        limit: s.limit,
        search: s.search,
        category: s.category
      });

      s.totalPages = res.totalPages;
      document.getElementById('inv-page-info').textContent = `Page ${res.currentPage} of ${res.totalPages} (${res.total} SKUs)`;
      document.getElementById('inv-btn-prev').disabled = s.page <= 1;
      document.getElementById('inv-btn-next').disabled = s.page >= s.totalPages;

      const tbody = document.getElementById('tbody-inventory');
      tbody.innerHTML = res.data
        .map(
          (item) => `
        <tr>
          <td><code>${item.productId}</code></td>
          <td><strong>${item.productName}</strong></td>
          <td><span class="badge" style="background:#f1f5f9; color:#475569;">${item.category || 'N/A'}</span></td>
          <td><strong>${item.totalQuantitySold}</strong> units</td>
          <td>$${item.totalSalesVolume.toFixed(2)}</td>
          <td style="color: ${item.totalProfit >= 0 ? 'var(--success)' : 'var(--danger)'}">$${item.totalProfit.toFixed(2)}</td>
          <td>${item.orderOccurrences} orders</td>
        </tr>`
        )
        .join('');
    } catch (err) {
      alert(`Error loading inventory: ${err.message}`);
    }
  },

  debounce(func, wait) {
    let timeout;
    return function (...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }
};

window.addEventListener('DOMContentLoaded', () => App.init());
