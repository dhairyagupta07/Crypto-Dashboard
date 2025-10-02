// ============================================
// CRYPTO DASHBOARD - MAIN JAVASCRIPT FILE
// ============================================

// Configuration object
const CONFIG = {
  API_BASE: 'https://api.coingecko.com/api/v3',
  API_KEY: 'CG-J1zx1JGKCUGFAaUQW7UHDoG9', // CoinGecko API Key
  REFRESH_INTERVAL: 30000, // 30 seconds
  CHART_DAYS: 7, // 7 days of price history
  DEFAULT_COINS: ['bitcoin', 'ethereum', 'cardano', 'polkadot', 'chainlink', 'litecoin'],
  CURRENCY_SYMBOLS: {
      usd: '$',
      inr: '₹',
      eur: 'â‚¬'
  },
  SEARCH_DEBOUNCE: 500 // milliseconds
};

// Global state management
const AppState = {
  currentCurrency: 'usd',
  currentCoins: [...CONFIG.DEFAULT_COINS],
  refreshTimer: null,
  countdownTimer: null,
  searchTimeout: null,
  charts: {},
  isLoading: false
};

// DOM element references
const DOM = {
  cryptoGrid: null,
  searchInput: null,
  currencySelector: null,
  refreshStatus: null,
  countdown: null
};

// ============================================
// API HELPER FUNCTIONS
// ============================================

function getApiHeaders() {
  return {
      'Accept': 'application/json',
      'x-cg-demo-api-key': CONFIG.API_KEY
  };
}

async function makeApiRequest(url) {
  const response = await fetch(url, {
      method: 'GET',
      headers: getApiHeaders()
  });
  
  if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  initializeDOM();
  setupEventListeners();
  loadCryptocurrencies();
  startAutoRefresh();
});

function initializeDOM() {
  DOM.cryptoGrid = document.getElementById('cryptoGrid');
  DOM.searchInput = document.getElementById('searchInput');
  DOM.currencySelector = document.getElementById('currencySelector');
  DOM.refreshStatus = document.getElementById('refreshStatus');
  DOM.countdown = document.getElementById('countdown');
}

function setupEventListeners() {
  // Search functionality with debouncing
  DOM.searchInput.addEventListener('input', handleSearchDebounced);
  
  // Currency change
  DOM.currencySelector.addEventListener('change', handleCurrencyChange);
  
  // Cleanup on page unload
  window.addEventListener('beforeunload', cleanup);
}

// ============================================
// SEARCH FUNCTIONALITY
// ============================================

function handleSearchDebounced() {
  if (AppState.searchTimeout) {
      clearTimeout(AppState.searchTimeout);
  }
  
  AppState.searchTimeout = setTimeout(handleSearch, CONFIG.SEARCH_DEBOUNCE);
}

async function handleSearch() {
  const query = DOM.searchInput.value.trim().toLowerCase();
  
  if (query === '') {
      AppState.currentCoins = [...CONFIG.DEFAULT_COINS];
      await loadCryptocurrencies();
      return;
  }

  if (query.length < 2) {
      return; // Wait for at least 2 characters
  }

  try {
      showSearchingState();
      
      const url = `${CONFIG.API_BASE}/search?query=${encodeURIComponent(query)}`;
      const data = await makeApiRequest(url);
      
      if (data.coins && data.coins.length > 0) {
          // Get top 6 matching coins
          AppState.currentCoins = data.coins.slice(0, 6).map(coin => coin.id);
          await loadCryptocurrencies();
      } else {
          showError('No cryptocurrencies found matching your search.');
      }
  } catch (error) {
      console.error('Search error:', error);
      showError('Error searching cryptocurrencies. Please try again.');
  }
}

function showSearchingState() {
  if (!AppState.isLoading) {
      showLoading('Searching...');
  }
}

// ============================================
// CURRENCY MANAGEMENT
// ============================================

async function handleCurrencyChange() {
  const newCurrency = DOM.currencySelector.value;
  
  if (newCurrency !== AppState.currentCurrency) {
      AppState.currentCurrency = newCurrency;
      await loadCryptocurrencies();
  }
}

// ============================================
// DATA LOADING
// ============================================

async function loadCryptocurrencies() {
  if (AppState.isLoading) {
      return; // Prevent multiple simultaneous requests
  }
  
  AppState.isLoading = true;
  
  try {
      showLoading();
      
      // Get market data and chart data in parallel
      const [marketData, chartsData] = await Promise.all([
          fetchMarketData(),
          fetchChartsData()
      ]);
      
      if (marketData && marketData.length > 0) {
          renderCryptoCards(marketData, chartsData);
      } else {
          showError('No cryptocurrency data available.');
      }
      
  } catch (error) {
      console.error('Error loading cryptocurrencies:', error);
      showError('Failed to load cryptocurrency data. Please check your connection and try again.');
  } finally {
      AppState.isLoading = false;
  }
}

async function fetchMarketData() {
  const coinsParam = AppState.currentCoins.join(',');
  const url = `${CONFIG.API_BASE}/coins/markets?vs_currency=${AppState.currentCurrency}&ids=${coinsParam}&order=market_cap_desc&per_page=100&page=1&sparkline=false&price_change_percentage=24h`;
  
  return await makeApiRequest(url);
}

async function fetchChartsData() {
  const chartsData = {};
  
  try {
      const promises = AppState.currentCoins.map(async (coinId) => {
          try {
              const url = `${CONFIG.API_BASE}/coins/${coinId}/market_chart?vs_currency=${AppState.currentCurrency}&days=${CONFIG.CHART_DAYS}&interval=daily`;
              const data = await makeApiRequest(url);
              return { coinId, data };
          } catch (error) {
              console.warn(`Failed to load chart for ${coinId}:`, error);
              return { coinId, data: null };
          }
      });
      
      const results = await Promise.all(promises);
      
      results.forEach(({ coinId, data }) => {
          if (data && data.prices) {
              chartsData[coinId] = data.prices;
          }
      });
      
  } catch (error) {
      console.warn('Error loading charts data:', error);
  }
  
  return chartsData;
}

// ============================================
// RENDERING
// ============================================

function renderCryptoCards(marketData, chartsData) {
  const currencySymbol = CONFIG.CURRENCY_SYMBOLS[AppState.currentCurrency];
  
  const cardsHTML = marketData.map((coin, index) => {
      const changeClass = (coin.price_change_percentage_24h || 0) >= 0 ? 'change-positive' : 'change-negative';
      const changeSymbol = (coin.price_change_percentage_24h || 0) >= 0 ? '+' : '';
      const changeValue = coin.price_change_percentage_24h?.toFixed(2) || '0.00';
      
      return `
          <div class="crypto-card" style="animation-delay: ${index * 0.1}s;">
              <div class="card-header">
                  <img src="${coin.image}" alt="${coin.name}" class="coin-logo" loading="lazy">
                  <div class="coin-info">
                      <h3>${coin.name}</h3>
                      <span class="coin-symbol">${coin.symbol.toUpperCase()}</span>
                  </div>
              </div>
              
              <div class="price-section">
                  <div class="price-item">
                      <div class="price-label">Current Price</div>
                      <div class="price-value current-price">
                          ${currencySymbol}${formatPrice(coin.current_price)}
                      </div>
                  </div>
                  
                  <div class="price-item">
                      <div class="price-label">24h Change</div>
                      <div class="price-value ${changeClass}">
                          ${changeSymbol}${changeValue}%
                      </div>
                  </div>
                  
                  <div class="price-item">
                      <div class="price-label">Market Cap</div>
                      <div class="price-value">
                          ${currencySymbol}${formatLargeNumber(coin.market_cap || 0)}
                      </div>
                  </div>
                  
                  <div class="price-item">
                      <div class="price-label">24h Volume</div>
                      <div class="price-value">
                          ${currencySymbol}${formatLargeNumber(coin.total_volume || 0)}
                      </div>
                  </div>
              </div>
              
              <div class="chart-container">
                  <canvas id="chart-${coin.id}" width="300" height="150"></canvas>
              </div>
          </div>
      `;
  }).join('');
  
  DOM.cryptoGrid.innerHTML = cardsHTML;
  
  // Initialize charts after DOM is updated
  requestAnimationFrame(() => {
      marketData.forEach(coin => {
          if (chartsData[coin.id]) {
              createChart(coin.id, chartsData[coin.id]);
          } else {
              createEmptyChart(coin.id);
          }
      });
  });
}

// ============================================
// CHART MANAGEMENT
// ============================================

function createChart(coinId, priceData) {
  const canvas = document.getElementById(`chart-${coinId}`);
  if (!canvas) return;
  
  // Destroy existing chart
  destroyChart(coinId);
  
  const ctx = canvas.getContext('2d');
  
  // Process data
  const labels = priceData.map(point => {
      const date = new Date(point[0]);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  });
  
  const prices = priceData.map(point => point[1]);
  
  // Determine trend color
  const isPositiveTrend = prices[prices.length - 1] >= prices[0];
  const trendColor = isPositiveTrend ? '#4ade80' : '#f87171';
  
  AppState.charts[coinId] = new Chart(ctx, {
      type: 'line',
      data: {
          labels: labels,
          datasets: [{
              data: prices,
              borderColor: trendColor,
              backgroundColor: `${trendColor}15`,
              borderWidth: 2,
              fill: true,
              tension: 0.4,
              pointRadius: 0,
              pointHoverRadius: 6,
              pointHoverBackgroundColor: trendColor,
              pointHoverBorderColor: '#fff',
              pointHoverBorderWidth: 2
          }]
      },
      options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
              legend: { display: false },
              tooltip: {
                  backgroundColor: 'rgba(0, 0, 0, 0.8)',
                  titleColor: '#fff',
                  bodyColor: '#fff',
                  borderColor: trendColor,
                  borderWidth: 1,
                  cornerRadius: 8,
                  displayColors: false,
                  callbacks: {
                      label: function(context) {
                          return `${CONFIG.CURRENCY_SYMBOLS[AppState.currentCurrency]}${formatPrice(context.parsed.y)}`;
                      }
                  }
              }
          },
          scales: {
              x: {
                  display: true,
                  grid: {
                      color: 'rgba(255, 255, 255, 0.1)',
                      drawBorder: false
                  },
                  ticks: {
                      color: 'rgba(255, 255, 255, 0.7)',
                      maxTicksLimit: 4,
                      font: { size: 11 }
                  }
              },
              y: {
                  display: true,
                  grid: {
                      color: 'rgba(255, 255, 255, 0.1)',
                      drawBorder: false
                  },
                  ticks: {
                      color: 'rgba(255, 255, 255, 0.7)',
                      font: { size: 11 },
                      callback: function(value) {
                          return CONFIG.CURRENCY_SYMBOLS[AppState.currentCurrency] + formatPrice(value);
                      }
                  }
              }
          },
          interaction: {
              intersect: false,
              mode: 'index'
          },
          animation: {
              duration: 1500,
              easing: 'easeInOutQuart'
          }
      }
  });
}

function createEmptyChart(coinId) {
  const canvas = document.getElementById(`chart-${coinId}`);
  if (!canvas) return;
  
  destroyChart(coinId);
  
  const ctx = canvas.getContext('2d');
  
  AppState.charts[coinId] = new Chart(ctx, {
      type: 'line',
      data: {
          labels: ['No Data'],
          datasets: [{
              data: [0],
              borderColor: 'rgba(255, 255, 255, 0.3)',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              borderWidth: 1
          }]
      },
      options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
              x: { display: false },
              y: { display: false }
          }
      }
  });
}

function destroyChart(coinId) {
  if (AppState.charts[coinId]) {
      AppState.charts[coinId].destroy();
      delete AppState.charts[coinId];
  }
}

// ============================================
// AUTO-REFRESH FUNCTIONALITY
// ============================================

function startAutoRefresh() {
  let seconds = 30;
  
  // Update countdown display
  updateCountdown(seconds);
  
  // Countdown timer
  AppState.countdownTimer = setInterval(() => {
      seconds--;
      updateCountdown(seconds);
      
      if (seconds <= 0) {
          seconds = 30;
      }
  }, 1000);
  
  // Data refresh timer
  AppState.refreshTimer = setInterval(async () => {
      if (!AppState.isLoading) {
          await loadCryptocurrencies();
      }
      seconds = 30;
      updateCountdown(seconds);
  }, CONFIG.REFRESH_INTERVAL);
}

function updateCountdown(seconds) {
  if (DOM.countdown) {
      DOM.countdown.textContent = `${seconds}s`;
  }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function formatPrice(price) {
  if (!price && price !== 0) return '0.00';
  
  if (price >= 1) {
      return new Intl.NumberFormat('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
      }).format(price);
  } else {
      return new Intl.NumberFormat('en-US', {
          minimumFractionDigits: 4,
          maximumFractionDigits: 8
      }).format(price);
  }
}

function formatLargeNumber(num) {
  if (!num && num !== 0) return '0';
  
  if (num >= 1e12) {
      return (num / 1e12).toFixed(2) + 'T';
  } else if (num >= 1e9) {
      return (num / 1e9).toFixed(2) + 'B';
  } else if (num >= 1e6) {
      return (num / 1e6).toFixed(2) + 'M';
  } else if (num >= 1e3) {
      return (num / 1e3).toFixed(2) + 'K';
  }
  return formatPrice(num);
}

// ============================================
// UI STATE MANAGEMENT
// ============================================

function showLoading(message = 'Loading cryptocurrency data...') {
  DOM.cryptoGrid.innerHTML = `
      <div class="loading">
          <div class="loading-spinner"></div>
          <p>${message}</p>
      </div>
  `;
}

function showError(message) {
  DOM.cryptoGrid.innerHTML = `
      <div class="error">
          <h3>âš ï¸ Error</h3>
          <p>${message}</p>
          <button onclick="loadCryptocurrencies()" style="
              margin-top: 15px; 
              padding: 10px 20px; 
              background: rgba(15,155,142,0.2); 
              border: 1px solid #0f9b8e; 
              border-radius: 8px; 
              color: white; 
              cursor: pointer;
              transition: all 0.3s ease;
          " onmouseover="this.style.background='rgba(15,155,142,0.3)'" onmouseout="this.style.background='rgba(15,155,142,0.2)'">
              Try Again
          </button>
      </div>
  `;
}

// ============================================
// CLEANUP
// ============================================

function cleanup() {
  // Clear all timers
  if (AppState.refreshTimer) {
      clearInterval(AppState.refreshTimer);
      AppState.refreshTimer = null;
  }
  
  if (AppState.countdownTimer) {
      clearInterval(AppState.countdownTimer);
      AppState.countdownTimer = null;
  }
  
  if (AppState.searchTimeout) {
      clearTimeout(AppState.searchTimeout);
      AppState.searchTimeout = null;
  }
  
  // Destroy all charts
  Object.keys(AppState.charts).forEach(coinId => {
      destroyChart(coinId);
  });
  
  console.log('Crypto Dashboard cleaned up successfully');
}