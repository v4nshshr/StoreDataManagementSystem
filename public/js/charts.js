/**
 * Simple & Clear Chart.js Visualizations for NoSQL Project Demo
 */
const DashboardCharts = {
  instances: {},

  destroyChart(id) {
    if (this.instances[id]) {
      this.instances[id].destroy();
      delete this.instances[id];
    }
  },

  // 1. Pipeline 1: Category Sales & Profit (Grouped Bar Chart)
  renderCategoryPerformance(canvasId, data) {
    this.destroyChart(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const categoryTotals = {};
    (data || []).forEach((item) => {
      const cat = item.category;
      if (!cat) return;
      if (!categoryTotals[cat]) {
        categoryTotals[cat] = { sales: 0, profit: 0 };
      }
      categoryTotals[cat].sales += (item.totalSales ?? item.categorySales ?? 0);
      categoryTotals[cat].profit += (item.totalProfit ?? item.categoryProfit ?? 0);
    });

    const labels = Object.keys(categoryTotals);
    const sales = labels.map((c) => Math.round(categoryTotals[c].sales));
    const profits = labels.map((c) => Math.round(categoryTotals[c].profit));

    this.instances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Total Sales ($)',
            data: sales,
            backgroundColor: '#3b82f6',
            borderRadius: 6
          },
          {
            label: 'Net Profit ($)',
            data: profits,
            backgroundColor: '#10b981',
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top' },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.dataset.label}: $${ctx.raw.toLocaleString()}`
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: (val) => '$' + (val >= 1000 ? (val / 1000) + 'k' : val)
            }
          }
        }
      }
    });
  },

  // 2. Pipeline 2: Monthly Timeline (Line Chart)
  renderSalesProfitTimeline(canvasId, data) {
    this.destroyChart(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const labels = (data || []).map((d) => d.period);
    const sales = (data || []).map((d) => d.totalSales);
    const profits = (data || []).map((d) => d.totalProfit);

    this.instances[canvasId] = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Monthly Sales ($)',
            data: sales,
            borderColor: '#2563eb',
            backgroundColor: 'rgba(37, 99, 235, 0.1)',
            fill: true,
            tension: 0.3,
            borderWidth: 2
          },
          {
            label: 'Monthly Profit ($)',
            data: profits,
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            fill: true,
            tension: 0.3,
            borderWidth: 2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top' },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.dataset.label}: $${ctx.raw.toLocaleString()}`
            }
          }
        },
        scales: {
          y: {
            ticks: {
              callback: (val) => '$' + (val >= 1000 ? (val / 1000) + 'k' : val)
            }
          }
        }
      }
    });
  },

  // 3. Pipeline 3: Shipping Mode Transit Time (Horizontal Bar Chart)
  renderShippingTimes(canvasId, data) {
    this.destroyChart(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const labels = (data || []).map((d) => d.shipMode);
    const days = (data || []).map((d) => d.avgShippingDays ?? d.avgDays ?? 0);

    this.instances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            axis: 'y',
            label: 'Average Transit Days',
            data: days,
            backgroundColor: ['#22c55e', '#3b82f6', '#f59e0b', '#64748b'],
            borderRadius: 6
          }
        ]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.raw} days on average`
            }
          }
        },
        scales: {
          x: {
            title: { display: true, text: 'Days from Order Date to Ship Date' },
            beginAtZero: true
          }
        }
      }
    });
  },

  // 4. Pipeline 4: Sales by Customer Segment (Doughnut Chart)
  renderSegmentSales(canvasId, data) {
    this.destroyChart(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const labels = (data || []).map((d) => d.segment);
    const sales = (data || []).map((d) => d.totalSales);

    this.instances[canvasId] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [
          {
            data: sales,
            backgroundColor: ['#6366f1', '#3b82f6', '#f59e0b'],
            borderWidth: 2,
            borderColor: '#ffffff'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom' }
        }
      }
    });
  }
};
