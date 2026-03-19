// log-bet.js - log bet modal, split calculator, kalshi fee adjustment, close detection

let _logBetSubmitting = false;
let _editingLogId = null;
let _editingBetId = null;

// ============================================================
// Kalshi Fee Functions (parabolic fee model)
// ============================================================

function kalshiFeePerContract(priceInCents, maxFee) {
  // fee = maxFee * price * (100 - price) / 2500
  // peaks at 50 cents, 0 at 0 and 100
  return maxFee * priceInCents * (100 - priceInCents) / 2500;
}

function kalshiEffectivePrice(rawPricePct, maxFee) {
  return rawPricePct + kalshiFeePerContract(rawPricePct, maxFee);
}

function kalshiRawFromEffective(effectivePct, maxFee) {
  // iterative reverse: effective = raw + fee(raw)
  let raw = effectivePct;
  for (let i = 0; i < 10; i++) {
    const fee = kalshiFeePerContract(raw, maxFee);
    raw = effectivePct - fee;
    if (raw <= 0) raw = 0.01;
    if (raw >= 100) raw = 99.99;
  }
  return raw;
}

function isKalshi(book) {
  return (book || '').toLowerCase() === 'kalshi';
}

function isPolymarket(book) {
  const b = (book || '').toLowerCase();
  return b === 'poly' || b === 'polymarket';
}

// ============================================================
// Modal Show/Hide
// ============================================================

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
  clearSplitFields();

  // Pre-fill fair odds from fairs data
  if (prefill?.team && prefill?.round) {
    const fairDecimal = getFairDecimalOdds(prefill.team, prefill.round);
    if (fairDecimal) {
      document.getElementById('log-bet-fair-american').value = decimalToAmerican(fairDecimal);
      document.getElementById('log-bet-fair-pct').value = (1 / fairDecimal * 100).toFixed(2) + '%';
    }
    const marketType = ROUND_TO_MARKET_TYPE[prefill.round];
    if (marketType) {
      document.getElementById('log-bet-market').value = marketType;
    }
  }

  updatePmFieldsVisibility();
  setupTeamAutocomplete();
}

function showLogBetModalEdit(logData) {
  // Open modal in edit mode, pre-filled with existing log data
  _editingLogId = logData.id;
  _editingBetId = logData.betId;

  const modal = document.getElementById('log-bet-modal');
  modal.style.display = 'block';
  _logBetSubmitting = false;

  // Update modal title and button
  const titleEl = modal.querySelector('h2');
  if (titleEl) titleEl.textContent = 'edit log #' + logData.id;
  const submitBtn = modal.querySelector('.modal-actions button:last-child');
  if (submitBtn) submitBtn.textContent = 'save';

  // Pre-fill fields
  document.getElementById('log-bet-book').value = logData.bookie || 'dk';

  // Convert decimal odds to american
  const odds = logData.odds || 0;
  const americanOdds = odds >= 2.0
    ? '+' + Math.round((odds - 1) * 100)
    : odds > 1 ? Math.round(-100 / (odds - 1)) : '';
  document.getElementById('log-bet-book-odds').value = americanOdds;

  // Stake
  document.getElementById('log-bet-stake').value = logData.stake || '';

  // PM fields
  document.getElementById('log-bet-bid-price').value = logData.bidPrice || '';
  document.getElementById('log-bet-filled').value = logData.filled || '';

  // Fair odds (from log data if available)
  const fairOdds = logData.fairOdds || 0;
  if (fairOdds > 1) {
    document.getElementById('log-bet-fair-american').value = decimalToAmerican(fairOdds);
    document.getElementById('log-bet-fair-pct').value = (1 / fairOdds * 100).toFixed(2) + '%';
  } else {
    document.getElementById('log-bet-fair-american').value = '';
    document.getElementById('log-bet-fair-pct').value = '';
  }

  // Notes
  document.getElementById('log-bet-notes').value = logData.notes || '';

  // Split calc fields for PM
  if (logData.isPM) {
    if (logData.sharesBid > 0) {
      document.getElementById('log-bet-taker-shares').value = logData.sharesFilled || '';
      document.getElementById('log-bet-taker-price').value = logData.bidPrice || '';
    }
  }

  // Other fields we don't pre-fill but need to clear
  document.getElementById('log-bet-kelly-display').textContent = '';
  document.getElementById('log-bet-edge-display').textContent = '';
  document.getElementById('log-bet-close-info').style.display = 'none';
  clearSplitFields();

  updatePmFieldsVisibility();
  recalculateKellyDisplay();
}

function closeLogBetModal() {
  document.getElementById('log-bet-modal').style.display = 'none';

  // Reset edit mode
  if (_editingLogId) {
    _editingLogId = null;
    _editingBetId = null;
    const modal = document.getElementById('log-bet-modal');
    const titleEl = modal.querySelector('h2');
    if (titleEl) titleEl.textContent = 'log bet';
    const submitBtn = modal.querySelector('.modal-actions button:last-child');
    if (submitBtn) submitBtn.textContent = 'log bet';
  }
}

// ============================================================
// PM Fields Visibility
// ============================================================

function updatePmFieldsVisibility() {
  const book = document.getElementById('log-bet-book').value;
  const splitSection = document.getElementById('log-bet-split-section');
  const stakeSection = document.getElementById('log-bet-stake-section');
  const sideField = document.getElementById('log-bet-side-container');

  if (isPmBook(book)) {
    splitSection.style.display = 'block';
    stakeSection.style.display = 'none';
    sideField.style.display = 'block';
    updateSplitPrices();
  } else {
    splitSection.style.display = 'none';
    stakeSection.style.display = 'block';
    sideField.style.display = 'none';
  }
}

// ============================================================
// Split Calculator
// ============================================================

function updateSplitPrices() {
  // Set taker/maker prices from book odds input or raw price
  const rawInput = document.getElementById('log-bet-raw-price').value;
  if (rawInput) {
    updateFromRawPrice();
  }
}

function updateFromRawPrice() {
  const rawPct = parseFloat(document.getElementById('log-bet-raw-price').value);
  if (isNaN(rawPct) || rawPct <= 0) return;

  const book = document.getElementById('log-bet-book').value;
  let takerPct, makerPct, feeDisplay = '';

  if (isKalshi(book)) {
    takerPct = kalshiEffectivePrice(rawPct, KALSHI_TAKER_MAX);
    makerPct = kalshiEffectivePrice(rawPct, KALSHI_MAKER_MAX);
    const takerFee = kalshiFeePerContract(rawPct, KALSHI_TAKER_MAX);
    const makerFee = kalshiFeePerContract(rawPct, KALSHI_MAKER_MAX);
    feeDisplay = 'taker fee: ' + takerFee.toFixed(2) + ' | maker fee: ' + makerFee.toFixed(2);
  } else {
    // polymarket or other PM -- no fees
    takerPct = rawPct;
    makerPct = rawPct;
    feeDisplay = 'no fees';
  }

  document.getElementById('log-bet-taker-price').value = takerPct.toFixed(2);
  document.getElementById('log-bet-maker-price').value = makerPct.toFixed(2);
  document.getElementById('log-bet-fee-display').textContent = feeDisplay;

  calculateSplit();
}

function calculateSplit() {
  const takerShares = parseFloat(document.getElementById('log-bet-taker-shares').value) || 0;
  const takerPrice = parseFloat(document.getElementById('log-bet-taker-price').value) || 0;
  const makerShares = parseFloat(document.getElementById('log-bet-maker-shares').value) || 0;
  const makerPrice = parseFloat(document.getElementById('log-bet-maker-price').value) || 0;

  // cost = shares * (price / 100)
  const takerCost = takerShares * (takerPrice / 100);
  const makerCost = makerShares * (makerPrice / 100);

  document.getElementById('log-bet-taker-cost').value = '$' + takerCost.toFixed(2);
  document.getElementById('log-bet-maker-cost').value = '$' + makerCost.toFixed(2);

  const totalShares = takerShares + makerShares;
  const totalCost = takerCost + makerCost;

  if (totalShares > 0) {
    const blendedPrice = (totalCost / totalShares) * 100;
    document.getElementById('log-bet-blended-shares').textContent = totalShares;
    document.getElementById('log-bet-blended-odds').textContent = blendedPrice.toFixed(2) + '%';
    document.getElementById('log-bet-blended-cost').textContent = totalCost.toFixed(2);

    // Update hidden fields for submission
    document.getElementById('log-bet-bid-price').value = blendedPrice.toFixed(2);
    document.getElementById('log-bet-filled').value = totalCost.toFixed(2);

    // Update book odds display and recalculate kelly
    document.getElementById('log-bet-book-odds').value = decimalToAmerican(100 / blendedPrice);
    recalculateKellyDisplay();
  } else {
    document.getElementById('log-bet-blended-shares').textContent = '0';
    document.getElementById('log-bet-blended-odds').textContent = '--';
    document.getElementById('log-bet-blended-cost').textContent = '0.00';
  }
}

function clearSplitFields() {
  const ids = ['log-bet-raw-price', 'log-bet-taker-shares', 'log-bet-taker-price',
    'log-bet-taker-cost', 'log-bet-maker-shares', 'log-bet-maker-price', 'log-bet-maker-cost'];
  ids.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  document.getElementById('log-bet-blended-shares').textContent = '0';
  document.getElementById('log-bet-blended-odds').textContent = '--';
  document.getElementById('log-bet-blended-cost').textContent = '0.00';
  document.getElementById('log-bet-fee-display').textContent = '';
}

// ============================================================
// Team Autocomplete
// ============================================================

function setupTeamAutocomplete() {
  const datalist = document.getElementById('team-list');
  datalist.innerHTML = '';
  getAllTeams().forEach(name => {
    const option = document.createElement('option');
    option.value = name;
    datalist.appendChild(option);
  });
}

// ============================================================
// Fair Odds
// ============================================================

function updateFairFromSelection() {
  const team = document.getElementById('log-bet-team').value;
  const market = document.getElementById('log-bet-market').value;
  if (!team) return;

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

// ============================================================
// Kelly / Edge Display
// ============================================================

function recalculateKellyDisplay() {
  const fairPctStr = document.getElementById('log-bet-fair-pct').value.replace('%', '');
  const bookOddsStr = document.getElementById('log-bet-book-odds').value;
  const book = document.getElementById('log-bet-book').value;

  const fairPct = parseFloat(fairPctStr);
  const fairDecimal = (fairPct > 0) ? 100 / fairPct : null;

  let bookDecimal = null;
  if (isPmBook(book)) {
    // for PM, book odds come from blended price (set by split calc) or book-odds field
    bookDecimal = americanToDecimal(bookOddsStr);
  } else {
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

// ============================================================
// Close Detection
// ============================================================

async function checkOppositePosition() {
  const team = document.getElementById('log-bet-team').value;
  const market = document.getElementById('log-bet-market').value;
  const side = document.getElementById('log-bet-side').value;
  const book = document.getElementById('log-bet-book').value;

  if (!team || !market || !side || !book) return;

  const tournament = document.getElementById('log-bet-tournament')?.value || 'March Madness 2025';

  try {
    const params = new URLSearchParams({
      player_name: team, tournament_name: tournament,
      market_type: market, side: side, bookie: book
    });
    const resp = await fetch('/api/find_opposite_position?' + params);
    const data = await resp.json();

    const closeInfo = document.getElementById('log-bet-close-info');
    if (data.exists) {
      closeInfo.style.display = 'block';
      closeInfo.textContent = 'opposite position: ' + data.shares.toFixed(0) + ' shares @ ' + data.avg_price.toFixed(1) + ' avg';
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

// ============================================================
// PM Bid Price (legacy compat for non-split flow)
// ============================================================

function onBidPriceChange() {
  const bidPrice = parseFloat(document.getElementById('log-bet-bid-price').value);
  const stake = parseFloat(document.getElementById('log-bet-stake').value);
  if (bidPrice > 0 && stake > 0) {
    const shares = Math.round(stake / (bidPrice / 100));
    const el = document.getElementById('log-bet-shares-display');
    if (el) el.textContent = shares + ' shares';
  }
  recalculateKellyDisplay();
}

// ============================================================
// Submit
// ============================================================

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
    const notes = document.getElementById('log-bet-notes').value;

    // Get stake from either split calc total or stake input
    let stake;
    if (isPmBook(book)) {
      stake = parseFloat(document.getElementById('log-bet-blended-cost')?.textContent) || 0;
    } else {
      stake = parseFloat(document.getElementById('log-bet-stake').value) || 0;
    }

    if (!team || stake <= 0) {
      alert('team and stake required');
      _logBetSubmitting = false;
      return;
    }

    const fairPct = parseFloat(fairPctStr);
    const fairDecimal = fairPct > 0 ? 100 / fairPct : 2.0;

    let bookDecimal;
    if (isPmBook(book)) {
      const bidPrice = parseFloat(document.getElementById('log-bet-bid-price').value);
      bookDecimal = bidPrice > 0 ? 100 / bidPrice : americanToDecimal(bookOddsStr) || fairDecimal;
    } else {
      bookDecimal = americanToDecimal(bookOddsStr) || fairDecimal;
    }

    const edge = calculateEdge(fairDecimal, bookDecimal);
    const kelly = calculateKellyBet(fairDecimal, bookDecimal);
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

    // Add PM fields from split calculator
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

    // Edit mode: PATCH individual fields on the existing log
    if (_editingLogId) {
      const updates = [
        { field: 'odds', value: bookDecimal },
        { field: 'stake_added', value: stake },
        { field: 'bookie', value: book }
      ];
      if (isPmBook(book)) {
        const bidPrice = parseFloat(document.getElementById('log-bet-bid-price').value);
        if (bidPrice > 0) updates.push({ field: 'bid_price', value: bidPrice });
        const filled = parseFloat(document.getElementById('log-bet-filled').value);
        if (filled >= 0) updates.push({ field: 'filled_added', value: filled });
      }
      if (notes) updates.push({ field: 'notes', value: notes });

      let success = true;
      for (const upd of updates) {
        const r = await fetch('/update_bet_log/' + _editingLogId, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ field: upd.field, value: upd.value })
        });
        const d = await r.json();
        if (!d.success) { alert('error: ' + d.error); success = false; break; }
      }

      if (success) {
        const editBetId = _editingBetId;
        closeLogBetModal();
        if (typeof loadedLogs !== 'undefined') loadedLogs.delete(editBetId);
        if (typeof loadActiveBets === 'function') loadActiveBets();
      }
    } else {
      // Normal mode: POST new bet
      const resp = await fetch('/log_bet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await resp.json();

      if (data.success) {
        closeLogBetModal();
        if (typeof loadActiveBets === 'function') loadActiveBets();
        if (typeof loadBankroll === 'function') loadBankroll();
      } else {
        alert('error: ' + data.error);
      }
    }
  } catch (e) {
    alert('error: ' + e.message);
  } finally {
    _logBetSubmitting = false;
  }
}
