// log-bet.js - log bet modal, close detection

let _logBetSubmitting = false;

function showLogBetModal(prefill) {
  const modal = document.getElementById('log-bet-modal');
  modal.style.display = 'block';
  _logBetSubmitting = false;

  // Reset form
  document.getElementById('log-bet-team').value = prefill?.team || '';
  document.getElementById('log-bet-market').value = prefill?.market || 'win_title';
  document.getElementById('log-bet-book').value = prefill?.book || 'dk';
  document.getElementById('log-bet-side').value = prefill?.side || 'YES';
  document.getElementById('log-bet-fair-american').value = '';
  document.getElementById('log-bet-fair-pct').value = '';
  document.getElementById('log-bet-book-odds').value = '';
  document.getElementById('log-bet-stake').value = '';
  document.getElementById('log-bet-bid-price').value = '';
  document.getElementById('log-bet-filled').value = '';
  document.getElementById('log-bet-notes').value = '';
  document.getElementById('log-bet-kelly-display').textContent = '';
  document.getElementById('log-bet-edge-display').textContent = '';
  document.getElementById('log-bet-close-info').style.display = 'none';

  // Pre-fill fair odds from fairs data if team and market provided
  if (prefill?.team && prefill?.round) {
    const fairDecimal = getFairDecimalOdds(prefill.team, prefill.round);
    if (fairDecimal) {
      const fairAmerican = decimalToAmerican(fairDecimal);
      const fairPct = (1 / fairDecimal * 100).toFixed(2);
      document.getElementById('log-bet-fair-american').value = fairAmerican;
      document.getElementById('log-bet-fair-pct').value = fairPct + '%';
    }
    // Map round to market type
    const marketType = ROUND_TO_MARKET_TYPE[prefill.round];
    if (marketType) {
      document.getElementById('log-bet-market').value = marketType;
    }
  }

  // Show/hide PM fields based on book
  updatePmFieldsVisibility();

  // Set up team autocomplete
  setupTeamAutocomplete();
}

function closeLogBetModal() {
  document.getElementById('log-bet-modal').style.display = 'none';
}

function updatePmFieldsVisibility() {
  const book = document.getElementById('log-bet-book').value;
  const pmFields = document.getElementById('log-bet-pm-fields');
  const sideField = document.getElementById('log-bet-side-container');

  if (isPmBook(book)) {
    pmFields.style.display = 'block';
    sideField.style.display = 'block';
  } else {
    pmFields.style.display = 'none';
    sideField.style.display = 'none';
  }
}

function setupTeamAutocomplete() {
  const input = document.getElementById('log-bet-team');
  const datalist = document.getElementById('team-list');
  datalist.innerHTML = '';
  getAllTeams().forEach(name => {
    const option = document.createElement('option');
    option.value = name;
    datalist.appendChild(option);
  });
}

// Update fair odds when team or market changes
function updateFairFromSelection() {
  const team = document.getElementById('log-bet-team').value;
  const market = document.getElementById('log-bet-market').value;

  if (!team) return;

  // Find which round key matches this market
  let roundKey = null;
  for (const [rk, mt] of Object.entries(ROUND_TO_MARKET_TYPE)) {
    if (mt === market) { roundKey = rk; break; }
  }

  if (!roundKey) return;

  const fairDecimal = getFairDecimalOdds(team, roundKey);
  if (fairDecimal) {
    document.getElementById('log-bet-fair-american').value = decimalToAmerican(fairDecimal);
    document.getElementById('log-bet-fair-pct').value = (1 / fairDecimal * 100).toFixed(2) + '%';
    recalculateKellyDisplay();
  }
}

// Bidirectional fair odds conversion
function onFairAmericanChange() {
  const american = document.getElementById('log-bet-fair-american').value;
  const pct = americanToPercentage(american);
  if (pct !== null) {
    document.getElementById('log-bet-fair-pct').value = pct.toFixed(2) + '%';
  }
  recalculateKellyDisplay();
}

function onFairPctChange() {
  const pctStr = document.getElementById('log-bet-fair-pct').value.replace('%', '');
  const american = percentageToAmerican(pctStr);
  if (american !== null) {
    document.getElementById('log-bet-fair-american').value = formatAmericanOdds(american);
  }
  recalculateKellyDisplay();
}

// Recalculate Kelly suggestion and edge display
function recalculateKellyDisplay() {
  const fairPctStr = document.getElementById('log-bet-fair-pct').value.replace('%', '');
  const bookOddsStr = document.getElementById('log-bet-book-odds').value;
  const book = document.getElementById('log-bet-book').value;

  const fairPct = parseFloat(fairPctStr);
  const fairDecimal = (fairPct > 0) ? 100 / fairPct : null;

  let bookDecimal = null;
  if (isPmBook(book)) {
    // For PM books, book odds come from bid price
    const bidPrice = parseFloat(document.getElementById('log-bet-bid-price').value);
    if (bidPrice > 0) bookDecimal = 100 / bidPrice;
  } else {
    // For traditional, parse american odds
    bookDecimal = americanToDecimal(bookOddsStr);
  }

  if (fairDecimal && bookDecimal) {
    const kelly = calculateKellyBet(fairDecimal, bookDecimal);
    const edge = calculateEdge(fairDecimal, bookDecimal);
    document.getElementById('log-bet-kelly-display').textContent = 'kelly: $' + kelly.toFixed(2);
    document.getElementById('log-bet-edge-display').textContent = 'edge: ' + edge.toFixed(1) + '%';
    document.getElementById('log-bet-edge-display').style.color = edge > 0 ? '#4caf50' : '#ff4b4b';
  } else {
    document.getElementById('log-bet-kelly-display').textContent = '';
    document.getElementById('log-bet-edge-display').textContent = '';
  }
}

// Check for opposite position (close detection)
async function checkOppositePosition() {
  const team = document.getElementById('log-bet-team').value;
  const market = document.getElementById('log-bet-market').value;
  const side = document.getElementById('log-bet-side').value;
  const book = document.getElementById('log-bet-book').value;

  if (!team || !market || !side || !book) return;

  // Get tournament from events (use first active event)
  const tournament = document.getElementById('log-bet-tournament')?.value || 'March Madness 2025';

  try {
    const params = new URLSearchParams({
      player_name: team,
      tournament_name: tournament,
      market_type: market,
      side: side,
      bookie: book
    });
    const resp = await fetch('/api/find_opposite_position?' + params);
    const data = await resp.json();

    const closeInfo = document.getElementById('log-bet-close-info');
    if (data.exists) {
      closeInfo.style.display = 'block';
      closeInfo.textContent = 'opposite position found: ' + data.shares.toFixed(0) + ' shares @ ' + data.avg_price.toFixed(1) + ' avg';
      closeInfo.dataset.betId = data.bet_id;
      closeInfo.dataset.shares = data.shares;
      closeInfo.dataset.avgPrice = data.avg_price;
    } else {
      closeInfo.style.display = 'none';
    }
  } catch (e) {
    console.error('close check error:', e);
  }
}

// PM bid price change handlers
function onBidPriceChange() {
  const bidPrice = parseFloat(document.getElementById('log-bet-bid-price').value);
  const stake = parseFloat(document.getElementById('log-bet-stake').value);

  if (bidPrice > 0 && stake > 0) {
    const shares = Math.round(stake / (bidPrice / 100));
    document.getElementById('log-bet-shares-display').textContent = shares + ' shares';
  }
  recalculateKellyDisplay();
}

// Submit bet
async function submitLogBet() {
  if (_logBetSubmitting) return;
  _logBetSubmitting = true;

  try {
    const team = document.getElementById('log-bet-team').value.trim();
    const market = document.getElementById('log-bet-market').value;
    const book = document.getElementById('log-bet-book').value;
    const side = document.getElementById('log-bet-side').value;
    const fairPctStr = document.getElementById('log-bet-fair-pct').value.replace('%', '');
    const bookOddsStr = document.getElementById('log-bet-book-odds').value;
    const stake = parseFloat(document.getElementById('log-bet-stake').value);
    const notes = document.getElementById('log-bet-notes').value;

    if (!team || !stake || stake <= 0) {
      alert('team and stake required');
      _logBetSubmitting = false;
      return;
    }

    const fairPct = parseFloat(fairPctStr);
    const fairDecimal = fairPct > 0 ? 100 / fairPct : 2.0;

    let bookDecimal;
    if (isPmBook(book)) {
      const bidPrice = parseFloat(document.getElementById('log-bet-bid-price').value);
      bookDecimal = bidPrice > 0 ? 100 / bidPrice : fairDecimal;
    } else {
      bookDecimal = americanToDecimal(bookOddsStr) || fairDecimal;
    }

    const edge = calculateEdge(fairDecimal, bookDecimal);
    const kelly = calculateKellyBet(fairDecimal, bookDecimal);

    // Get tournament name
    const tournament = document.getElementById('log-bet-tournament')?.value || 'March Madness 2025';

    const payload = {
      tournament_name: tournament,
      market_type: market,
      player_name: team,
      bookie: book,
      fair_odds: fairDecimal,
      book_odds: bookDecimal,
      edge_percent: edge,
      predicted_kelly: kelly,
      actual_stake: stake,
      side: isPmBook(book) ? side : null,
      notes: notes || null
    };

    // Add PM fields
    if (isPmBook(book)) {
      const bidPrice = parseFloat(document.getElementById('log-bet-bid-price').value);
      if (bidPrice > 0) {
        payload.bid_price = bidPrice;
      }
      const filled = parseFloat(document.getElementById('log-bet-filled').value);
      if (filled > 0) {
        payload.filled_amount = filled;
      }
    }

    // Check for close
    const closeInfo = document.getElementById('log-bet-close-info');
    if (closeInfo.style.display !== 'none' && closeInfo.dataset.betId) {
      const bidPrice = parseFloat(document.getElementById('log-bet-bid-price').value) || 0;
      if (bidPrice > 0) {
        payload.close_data = {
          close_bet_id: parseInt(closeInfo.dataset.betId),
          close_shares: parseFloat(closeInfo.dataset.shares),
          close_price: 100 - bidPrice,
          existing_avg_price: parseFloat(closeInfo.dataset.avgPrice)
        };
      }
    }

    const resp = await fetch('/log_bet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await resp.json();

    if (data.success) {
      closeLogBetModal();
      // Refresh tracking and bankroll
      if (typeof loadActiveBets === 'function') loadActiveBets();
      if (typeof loadBankroll === 'function') loadBankroll();
    } else {
      alert('error: ' + data.error);
    }
  } catch (e) {
    alert('error: ' + e.message);
  } finally {
    _logBetSubmitting = false;
  }
}
