/**
 * US Retail Store - NoSQL MongoDB Demonstration App Controller
 */
const App = {
  async init() {
    this.bindEvents();
    await this.loadAnalytics();
    await this.loadCrudProducts();
  },

  bindEvents() {
    // 1. Tab Navigation
    document.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));

        btn.classList.add('active');
        const targetId = btn.getAttribute('data-tab');
        const targetPanel = document.getElementById(targetId);
        if (targetPanel) targetPanel.classList.add('active');
      });
    });

    // 2. Toggle MongoDB Query Code Boxes
    document.querySelectorAll('.toggle-code-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-target');
        const box = document.getElementById(targetId);
        if (box) {
          box.classList.toggle('active');
          btn.innerHTML = box.classList.contains('active')
            ? '<i class="fa-solid fa-eye-slash"></i> Hide Query'
            : '<i class="fa-solid fa-code"></i> View MongoDB Query';
        }
      });
    });

    // 3. CRUD: Search Filter Button
    const searchBtn = document.getElementById('btn-run-search');
    if (searchBtn) {
      searchBtn.addEventListener('click', () => this.loadCrudProducts());
    }

    const searchInput = document.getElementById('crud-search-input');
    if (searchInput) {
      searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') this.loadCrudProducts();
      });
    }

    // 4. CRUD: Create Product Form
    const createForm = document.getElementById('form-create-product');
    if (createForm) {
      createForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleCreateProduct();
      });
    }
  },

  // ========================================================
  // TAB 1: AGGREGATION PIPELINES
  // ========================================================
  async loadAnalytics() {
    try {
      // 1. Fetch KPIs
      const kpis = await API.getKpis();
      if (kpis && kpis.data) {
        document.getElementById('metric-sales').textContent = `$${kpis.data.totalSales.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
        document.getElementById('metric-profit').textContent = `$${kpis.data.totalProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
        document.getElementById('metric-orders').textContent = kpis.data.totalOrders.toLocaleString();
        document.getElementById('metric-customers').textContent = kpis.data.totalCustomers.toLocaleString();
      }

      // 2. Fetch Aggregation Pipelines concurrently
      const [catRes, timeRes, topRes, shipRes] = await Promise.allSettled([
        API.getCategoryPerformance(),
        API.getSalesByYearMonth(),
        API.getTopCustomers(5),
        API.getShippingTime()
      ]);

      if (catRes.status === 'fulfilled') {
        DashboardCharts.renderCategoryPerformance('chart-category', catRes.value?.data || []);
      }

      if (timeRes.status === 'fulfilled') {
        DashboardCharts.renderSalesProfitTimeline('chart-timeline', timeRes.value?.data || []);
      }

      if (topRes.status === 'fulfilled') {
        this.renderTopCustomers(topRes.value?.data || []);
      }

      if (shipRes.status === 'fulfilled') {
        DashboardCharts.renderShippingTimes('chart-shipping', shipRes.value?.data || []);
      }
    } catch (err) {
      console.error('Failed to load analytics pipelines:', err);
    }
  },

  renderTopCustomers(customers) {
    const tbody = document.getElementById('tbody-top-customers');
    if (!tbody) return;

    if (!customers || customers.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="text-muted">No customer data returned</td></tr>';
      return;
    }

    tbody.innerHTML = customers
      .map(
        (c) => `
      <tr>
        <td>
          <strong>${c.name || c.customerName}</strong><br>
          <small class="text-muted">${c.customerId}</small>
        </td>
        <td><span class="badge badge-db">${c.segment}</span></td>
        <td><strong>$${(c.totalSpent || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong></td>
        <td class="text-green">+$${(c.totalProfitGenerated || c.totalProfit || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
      </tr>`
      )
      .join('');
  },

  // ========================================================
  // TAB 2: INTERACTIVE CRUD OPERATIONS
  // ========================================================
  async loadCrudProducts() {
    const search = document.getElementById('crud-search-input')?.value.trim() || '';
    const category = document.getElementById('crud-filter-cat')?.value || '';

    // Construct the equivalent MongoDB Shell command to show the student
    let mongoQuery = 'db.products.find(';
    const filterObj = {};
    if (search) filterObj.name = { $regex: search, $options: 'i' };
    if (category) filterObj.category = category;
    mongoQuery += JSON.stringify(filterObj, null, 2);
    mongoQuery += ').limit(10);';

    this.updateTerminal(mongoQuery, 'find() executing...');

    try {
      const res = await API.getProducts({ search, category, limit: 10 });
      const products = res.data || [];

      this.updateTerminal(
        `// 1. MongoDB Query Sent:\n${mongoQuery}\n\n// 2. Result:\nReturned ${products.length} documents (Total matched: ${res.total || products.length})`,
        'Success 200'
      );

      document.getElementById('results-count').textContent = `Showing ${products.length} of ${res.total || products.length} documents`;

      const tbody = document.getElementById('crud-products-tbody');
      if (!tbody) return;

      if (products.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-muted" style="text-align:center; padding: 2rem;">No matching products found. Try inserting one!</td></tr>';
        return;
      }

      tbody.innerHTML = products
        .map(
          (p) => `
        <tr>
          <td><code>${p.productId}</code></td>
          <td><strong>${p.name}</strong></td>
          <td><span class="badge badge-db">${p.category}</span></td>
          <td>${p.subCategory}</td>
          <td>
            <button class="btn btn-danger btn-sm" onclick="App.handleDeleteProduct('${p._id || p.productId}', '${p.name.replace(/'/g, "\\'")}')">
              <i class="fa-solid fa-trash"></i> Delete
            </button>
          </td>
        </tr>`
        )
        .join('');
    } catch (err) {
      this.updateTerminal(`Query failed: ${err.message}`, 'Error');
    }
  },

  async handleCreateProduct() {
    const productId = document.getElementById('new-prod-id').value.trim();
    const name = document.getElementById('new-prod-name').value.trim();
    const category = document.getElementById('new-prod-cat').value;
    const subCategory = document.getElementById('new-prod-subcat').value.trim();

    const productDoc = { productId, name, category, subCategory };

    const mongoCommand = `db.products.insertOne(${JSON.stringify(productDoc, null, 2)});`;
    this.updateTerminal(mongoCommand, 'insertOne() executing...');

    try {
      await API.createProduct(productDoc);
      this.updateTerminal(`// Executed:\n${mongoCommand}\n\n// Result:\nDocument successfully inserted into 'products' collection!`, 'Inserted!');
      alert(`Product "${name}" inserted successfully into MongoDB!`);

      // Reset form
      document.getElementById('form-create-product').reset();
      this.loadCrudProducts();
    } catch (err) {
      this.updateTerminal(`// Error executing insertOne():\n${err.message}`, 'Failed');
      alert(`Insert error: ${err.message}`);
    }
  },

  async handleDeleteProduct(id, name) {
    if (!confirm(`Are you sure you want to delete "${name}" from MongoDB?`)) return;

    const mongoCommand = `db.products.deleteOne({ _id: ObjectId("${id}") });`;
    this.updateTerminal(mongoCommand, 'deleteOne() executing...');

    try {
      await API.deleteProduct(id);
      this.updateTerminal(`// Executed:\n${mongoCommand}\n\n// Result:\nDocument deleted from 'products' collection!`, 'Deleted!');
      alert(`Product deleted successfully from MongoDB!`);
      this.loadCrudProducts();
    } catch (err) {
      this.updateTerminal(`// Error executing deleteOne():\n${err.message}`, 'Failed');
      alert(`Delete error: ${err.message}`);
    }
  },

  updateTerminal(code, status = 'Ready') {
    const terminal = document.getElementById('crud-terminal-code');
    const pill = document.getElementById('last-op-status');
    if (terminal) terminal.textContent = code;
    if (pill) {
      pill.textContent = status;
      pill.style.backgroundColor = status.includes('Error') || status.includes('Failed') ? '#ef4444' : '#10b981';
    }
  }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
