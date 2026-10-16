/**
 * Chart.js Visualizations for US Retail Store Analytics
 */
const DashboardCharts = {
  instances: {},

  destroyChart(id) {
    if (this.instances[id]) {
      this.instances[id].destroy();
      delete this.instances[id];
    }
  },

  // 1. Sales and Profit by Year-Month
  renderSalesProfitTimeline(canvasId, data) {
    this.destroyChart(canvasId);
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return;

    const labels = data.map((d) => d.period);
    const sales = data.map((d) => d.totalSales);
    const profits = data.map((d) => d.totalProfit);

    this.instances[canvasId] = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Sales ($)',
            data: sales,
            borderColor: '#2563eb',
            backgroundColor: 'rgba(37, 99, 235, 0.1)',
            fill: true,
            tension: 0.3,
            borderWidth: 2
          },
          {
            label: 'Profit ($)',
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
              label: (context) => `${context.dataset.label}: $${context.parsed.y.toLocaleString()}`
            }
          }
        },
        scales: {
          y: {
            ticks: {
              callback: (value) => '$' + (value >= 1000 ? (value / 1000) + 'k' : value)
            }
          }
        }
      }
    });
  },

  // 2. Category Performance (Grouped Bar)
  renderCategoryPerformance(canvasId, data) {
    this.destroyChart(canvasId);
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return;

    // Aggregate by category
    const categoryTotals = {};
    data.forEach((item) => {
      if (!categoryTotals[item.category]) {
        categoryTotals[item.category] = { sales: 0, profit: 0 };
      }
      categoryTotals[item.category].sales += item.totalSales;
      categoryTotals[item.category].profit += item.totalProfit;
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
            label: 'Sales ($)',
            data: sales,
            backgroundColor: '#3b82f6',
            borderRadius: 6
          },
          {
            label: 'Profit ($)',
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
          legend: { position: 'top' }
        },
        scales: {
          y: {
            ticks: {
              callback: (value) => '$' + (value >= 1000 ? (value / 1000) + 'k' : value)
            }
          }
        }
      }
    });
  },

  // 3. Sales by Customer Segment (Doughnut)
  renderSegmentSales(canvasId, data) {
    this.destroyChart(canvasId);
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return;

    const labels = data.map((d) => d.segment);
    const sales = data.map((d) => d.totalSales);

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
          legend: { position: 'bottom' },
          tooltip: {
            callbacks: {
              label: (context) => ` ${context.label}: $${context.raw.toLocaleString()} (${Math.round(context.parsed * 100 / sales.reduce((a, b) => a + b, 0))}%)`
            }
          }
        }
      }
    });
  },

  // 4. Profit by US Region (Bar)
  renderRegionalProfit(canvasId, data) {
    this.destroyChart(canvasId);
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return;

    const labels = data.map((d) => d.region);
    const profits = data.map((d) => d.regionProfit);
    const sales = data.map((d) => d.regionSales);

    this.instances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Net Profit ($)',
            data: profits,
            backgroundColor: '#10b981',
            borderRadius: 6
          },
          {
            label: 'Total Sales ($)',
            data: sales,
            backgroundColor: '#cbd5e1',
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top' }
        }
      }
    });
  },

  // 5. Discount Impact & Loss Rates
  renderDiscountImpact(canvasId, data) {
    this.destroyChart(canvasId);
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return;

    const labels = data.map((d) => d.discountBracket);
    const profits = data.map((d) => d.totalProfit);
    const lossRates = data.map((d) => d.lossRatePercent);

    this.instances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            type: 'bar',
            label: 'Total Profit ($)',
            data: profits,
            backgroundColor: profits.map((p) => (p >= 0 ? '#10b981' : '#ef4444')),
            borderRadius: 6,
            yAxisID: 'y'
          },
          {
            type: 'line',
            label: 'Loss-Making Items Rate (%)',
            data: lossRates,
            borderColor: '#dc2626',
            backgroundColor: '#dc2626',
            borderWidth: 2,
            tension: 0.2,
            yAxisID: 'y1'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top' }
        },
        scales: {
          y: {
            type: 'linear',
            position: 'left',
            title: { display: true, text: 'Net Profit ($)' }
          },
          y1: {
            type: 'linear',
            position: 'right',
            grid: { drawOnChartArea: false },
            title: { display: true, text: 'Loss Rate (%)' },
            min: 0,
            max: 100
          }
        }
      }
    });
  },

  // 6. Average Shipping Time
  renderShippingTimes(canvasId, data) {
    this.destroyChart(canvasId);
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return;

    const labels = data.map((d) => d.shipMode);
    const days = data.map((d) => d.avgShippingDays);

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
          legend: { display: false }
        },
        scales: {
          x: {
            title: { display: true, text: 'Days from Order to Ship' },
            beginAtZero: true
          }
        }
      }
    });
  }
};
