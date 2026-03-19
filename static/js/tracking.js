// tracking.js - bet tracking, event management, bet rendering

let loadedBets = [];
let loadedLogs = new Map();
let expandedBetIds = new Set();

// Tab switching
function showTab(tabName) {
  const fairsTab = document.getElementById('fairs-tab');
  const trackingTab = document.getElementById('tracking-tab');
  const fairsBtn = document.getElementById('fairs-tab-btn');
  const trackingBtn = document.getElementById('tracking-tab-btn');

  fairsTab.style.display = 'none';
  trackingTab.style.display = 'none';
  fairsBtn.classList.remove('active');
  trackingBtn.classList.remove('active');

  if (tabName === 'fairs') {
    fairsTab.style.display = 'block';
    fairsBtn.classList.add('active');
  } else if (tabName === 'tracking') {
    trackingTab.style.display = 'block';
    trackingBtn.classList.add('active');
    loadActiveBets();
  }

  sessionStorage.setItem('activeTab', tabName);
}

// Load active bets from API
async function loadActiveBets() {
  try {
    const resp = await fetch('/get_active_bets');
    const data = await resp.json();

    if (!data.success) {
      console.error('load bets error:', data.error);
      return;
    }

    loadedBets = data.bets || [];
    renderTracking(loadedBets, data.summary, data.pl_adjustments);
  } catch (e) {
    console.error('load bets error:', e);
  }
}

// Render the tracking tab
function renderTracking(bets, summary, plAdjustments) {
  const container = document.getElementById('tracking-content');
  if (!container) return;

  if (bets.length === 0) {
    container.innerHTML = '<div style="color: #888; padding: 20px; text-align: center;">no bets logged yet</div>';
    return;
  }

  // Group bets by tournament
  const byTournament = {};
  bets.forEach(bet => {
    const t = bet.tournament_name || 'unknown';
    if (!byTournament[t]) byTournament[t] = [];
    byTournament[t].push(bet);
  });

  let html = '';

  // Summary bar
  if (summary) {
    const plColor = summary.total_pl >= 0 ? '#4caf50' : '#ff4b4b';
    const plSign = summary.total_pl >= 0 ? '+' : '';
    html += '<div style="background: #262730; padding: 8px 12px; border-radius: 3px; margin-bottom: 12px; display: flex; gap: 16px; font-size: 12px;">';
    html += '<span>open: ' + summary.open_bets + '</span>';
    html += '<span>closed: ' + summary.closed_bets + '</span>';
    html += '<span>w/l: ' + summary.won + '/' + summary.lost + '</span>';
    html += '<span style="color: ' + plColor + ';">p/l: ' + plSign + '$' + summary.total_pl.toFixed(2) + '</span>';
    html += '</div>';
  }

  // Render each tournament
  for (const [tournament, tournamentBets] of Object.entries(byTournament)) {
    html += renderTournamentSection(tournament, tournamentBets);
  }

  container.innerHTML = html;

  // Re-expand previously expanded bets
  expandedBetIds.forEach(betId => {
    const logsRow = document.getElementById('bet-logs-' + betId);
    if (logsRow) logsRow.style.display = 'table-row';
  });
}

function renderTournamentSection(tournament, bets) {
  // Group by market category
  const categorized = {};
  CATEGORY_ORDER.forEach(cat => { categorized[cat] = []; });

  bets.forEach(bet => {
    const mt = bet.market_type || 'other';
    let placed = false;
    for (const [cat, types] of Object.entries(MARKET_CATEGORIES)) {
      if (types.includes(mt)) {
        categorized[cat].push(bet);
        placed = true;
        break;
      }
    }
    if (!placed) categorized['other'].push(bet);
  });

  let html = '<div class="tournament-section" style="margin-bottom: 16px;">';
  html += '<div class="section-header" onclick="toggleTournament(this)">';
  html += '<span>' + tournament + ' (' + bets.length + ')</span>';
  html += '<span style="font-size: 11px; color: #888;">&#9660;</span>';
  html += '</div>';
  html += '<div class="tournament-content">';

  // Render each non-empty category
  CATEGORY_ORDER.forEach(cat => {
    const catBets = categorized[cat];
    if (catBets.length === 0) return;

    // Category subtotals
    let catStake = 0, catPL = 0;
    catBets.forEach(b => {
      catStake += b.actual_stake || 0;
      if (b.status === 'Closed') catPL += b.profit_loss || 0;
    });

    const plColor = catPL >= 0 ? '#4caf50' : '#ff4b4b';
    const plSign = catPL >= 0 ? '+' : '';

    html += '<div style="margin: 8px 0 4px 0; font-size: 11px; color: #888; display: flex; justify-content: space-between;">';
    html += '<span>' + cat + ' (' + catBets.length + ')</span>';
    html += '<span>staked: $' + catStake.toFixed(0) + ' | p/l: <span style="color:' + plColor + '">' + plSign + '$' + catPL.toFixed(2) + '</span></span>';
    html += '</div>';

    html += '<table class="tracking-bet-table">';
    html += '<thead><tr>';
    html += '<th>team</th><th>market</th><th>book</th><th>odds</th><th>stake</th><th>status</th><th>p/l</th>';
    html += '</tr></thead><tbody>';

    catBets.forEach(bet => {
      html += renderBetRow(bet);
    });

    html += '</tbody></table>';
  });

  html += '</div></div>';
  return html;
}

function renderBetRow(bet) {
  const betId = bet.id;
  const americanOdds = bet.book_odds ? decimalToAmerican(bet.book_odds) : '--';
  const stake = bet.actual_stake ? '$' + bet.actual_stake.toFixed(2) : '--';
  const status = bet.status || 'Open';
  const pl = bet.profit_loss != null ? (bet.profit_loss >= 0 ? '+' : '') + '$' + bet.profit_loss.toFixed(2) : '--';
  const plColor = bet.profit_loss != null ? (bet.profit_loss >= 0 ? '#4caf50' : '#ff4b4b') : '#888';
  const statusColor = status === 'Open' ? '#4a90d9' : (bet.result === 'Won' ? '#4caf50' : bet.result === 'Lost' ? '#ff4b4b' : '#888');
  const marketDisplay = NCAA_MARKET_TYPES[bet.market_type] || bet.market_type || '--';
  const booksDisplay = bet.books_list || getBookAbbr(bet.bookie);
  const sideDisplay = (bet.side && bet.side !== 'None') ? (' ' + bet.side) : '';

  // Safe JSON for data attribute
  const safeJson = JSON.stringify(bet).replace(/'/g, '&#39;').replace(/"/g, '&quot;');

  let html = '<tr class="bet-row" id="bet-row-' + betId + '" data-bet="' + safeJson + '" onclick="toggleBetLogs(' + betId + ')" oncontextmenu="handleBetRowContextMenu(event, ' + betId + ', this)">';
  html += '<td>' + (bet.player_name || '--') + sideDisplay + '</td>';
  html += '<td>' + marketDisplay + '</td>';
  html += '<td>' + booksDisplay + '</td>';
  html += '<td>' + americanOdds + '</td>';
  html += '<td>' + stake + '</td>';
  html += '<td style="color:' + statusColor + '">' + status + (bet.result ? ' (' + bet.result + ')' : '') + '</td>';
  html += '<td style="color:' + plColor + '">' + pl + '</td>';
  html += '</tr>';

  // Hidden logs row
  html += '<tr id="bet-logs-' + betId + '" style="display:none"><td colspan="7"><div id="bet-logs-content-' + betId + '" style="padding: 4px 8px; background: #1a1a1a; font-size: 11px;">loading...</div></td></tr>';

  return html;
}

// Toggle bet logs expand/collapse
async function toggleBetLogs(betId) {
  const logsRow = document.getElementById('bet-logs-' + betId);
  if (!logsRow) return;

  if (logsRow.style.display === 'table-row') {
    logsRow.style.display = 'none';
    expandedBetIds.delete(betId);
    return;
  }

  logsRow.style.display = 'table-row';
  expandedBetIds.add(betId);

  // Load logs if not cached
  if (!loadedLogs.has(betId)) {
    try {
      const resp = await fetch('/get_bet_logs/' + betId);
      const data = await resp.json();
      if (data.success) {
        loadedLogs.set(betId, data);
        renderBetLogs(betId, data);
      }
    } catch (e) {
      document.getElementById('bet-logs-content-' + betId).textContent = 'error loading logs';
    }
  } else {
    renderBetLogs(betId, loadedLogs.get(betId));
  }
}

function renderBetLogs(betId, data) {
  const container = document.getElementById('bet-logs-content-' + betId);
  if (!container || !data.books) return;

  let html = '';

  for (const [bookName, bookData] of Object.entries(data.books)) {
    const displayName = normalizeBookName(bookName);
    html += '<div style="margin-bottom: 6px;">';
    html += '<div style="color: #aaa; font-weight: 600; margin-bottom: 2px;">' + displayName;
    if (bookData.weighted_odds > 0) {
      html += ' -- avg: ' + decimalToAmerican(bookData.weighted_odds);
    }
    html += ' -- staked: $' + bookData.total_stake.toFixed(2);
    if (bookData.total_filled > 0) {
      html += ' -- filled: $' + bookData.total_filled.toFixed(2);
    }
    html += '</div>';

    // Individual log rows
    bookData.bet_logs.forEach(log => {
      const logOdds = log.odds ? decimalToAmerican(log.odds) : '--';
      const logStake = log.stake_added ? '$' + log.stake_added.toFixed(2) : '--';
      const logFilled = log.filled_added ? '$' + log.filled_added.toFixed(2) : '';
      const logTime = log.timestamp ? formatTimeAgo(log.timestamp) : '';
      const notes = log.notes || '';

      html += '<div style="display: flex; gap: 8px; padding: 2px 0; color: #ccc;">';
      html += '<span style="min-width: 55px;">' + logStake + '</span>';
      if (logFilled) html += '<span style="min-width: 55px; color: #4caf50;">filled ' + logFilled + '</span>';
      html += '<span style="min-width: 50px;">' + logOdds + '</span>';
      if (log.bid_price) html += '<span style="min-width: 40px; color: #888;">' + log.bid_price.toFixed(1) + 'c</span>';
      html += '<span style="color: #666; flex: 1;">' + logTime + '</span>';
      if (notes) html += '<span style="color: #555; font-style: italic;">' + notes + '</span>';

      // Delete button
      html += '<span style="cursor: pointer; color: #666;" onclick="event.stopPropagation(); deleteLogEntry(' + log.id + ', ' + betId + ')" title="delete log">[x]</span>';
      html += '</div>';
    });

    html += '</div>';
  }

  container.innerHTML = html || '<span style="color: #666;">no logs</span>';
}

async function deleteLogEntry(logId, betId) {
  if (!confirm('delete this log entry?')) return;

  try {
    const resp = await fetch('/delete_bet_log/' + logId, { method: 'DELETE' });
    const data = await resp.json();
    if (data.success) {
      loadedLogs.delete(betId);
      expandedBetIds.delete(betId);
      loadActiveBets();
    } else {
      alert('error: ' + data.error);
    }
  } catch (e) {
    alert('error: ' + e.message);
  }
}

function toggleTournament(header) {
  const content = header.nextElementSibling;
  const arrow = header.querySelector('span:last-child');
  if (content.style.display === 'none') {
    content.style.display = 'block';
    arrow.innerHTML = '&#9660;';
  } else {
    content.style.display = 'none';
    arrow.innerHTML = '&#9654;';
  }
}
