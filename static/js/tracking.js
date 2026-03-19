// tracking.js - bet tracking, event management, bet rendering, expand/collapse, fill management

let loadedBets = [];
let loadedLogs = new Map();
let expandedBetIds = new Set();
let expandedBooks = new Set();

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
  if (expandedBetIds.size > 0) {
    const idsToExpand = [...expandedBetIds];
    idsToExpand.forEach(id => loadedLogs.delete(id));
    setTimeout(async () => {
      for (const id of idsToExpand) {
        const logsRow = document.getElementById('bet-logs-' + id);
        if (logsRow && logsRow.style.display === 'none') {
          expandedBetIds.delete(id);
          await toggleBetLogs(id);
        }
      }
      // Re-expand books
      for (const bookId of expandedBooks) {
        const el = document.getElementById(bookId);
        if (el) el.style.display = 'block';
      }
    }, 50);
  }
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
  html += '<tr id="bet-logs-' + betId + '" style="display:none"><td colspan="7"><div id="bet-logs-content-' + betId + '" style="padding: 8px; background: #1a1a1a;">loading...</div></td></tr>';

  return html;
}

// ============================================================
// Toggle Bet Logs (expand/collapse)
// ============================================================

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

  // Always reload to get fresh data
  loadedLogs.delete(betId);

  try {
    const resp = await fetch('/get_bet_logs/' + betId);
    const data = await resp.json();
    if (data.success) {
      loadedLogs.set(betId, data);
      renderBetLogs(betId, data);
    } else {
      document.getElementById('bet-logs-content-' + betId).innerHTML =
        '<span style="color: #ff4b4b;">error: ' + data.error + '</span>';
    }
  } catch (e) {
    document.getElementById('bet-logs-content-' + betId).innerHTML =
      '<span style="color: #ff4b4b;">error loading logs</span>';
  }
}

// ============================================================
// Render Bet Logs (book aggregates + individual logs)
// ============================================================

function renderBetLogs(betId, data) {
  const container = document.getElementById('bet-logs-content-' + betId);
  if (!container || !data.books) return;

  const bet = data.bet || {};
  let html = '';

  for (const [bookName, bookData] of Object.entries(data.books)) {
    const isPM = isPmBook(bookName);
    const bookId = 'book-' + betId + '-' + bookName.replace(/\s+/g, '-');
    const displayName = normalizeBookName(bookName);

    // Calculate american odds
    const wOdds = bookData.weighted_odds;
    const oddsAmerican = wOdds >= 2.0
      ? '+' + ((wOdds - 1) * 100).toFixed(1)
      : wOdds > 1 ? (-100 / (wOdds - 1)).toFixed(1) : '--';

    // Book aggregate row (Level 2)
    html += '<div style="margin-bottom: 8px;">';
    html += '<div onclick="toggleBook(\'' + bookId + '\')" style="cursor: pointer; padding: 6px 8px; background: #1e1e2a; border-left: 3px solid #4a90d9; margin-bottom: 3px; font-size: 12px;">';
    html += '<span style="font-weight: 600; color: #ddd;">&#9660; ' + displayName + '</span>';
    html += ' | $' + bookData.total_stake.toFixed(2) + ' bid';
    if (bookData.total_filled > 0) {
      html += ' | $' + bookData.total_filled.toFixed(2) + ' filled';
    }
    html += ' | ' + oddsAmerican;
    if (isPM && (bookData.total_shares_filled > 0 || bookData.total_shares_bid > 0)) {
      html += ' | ' + Math.round(bookData.total_shares_filled) + '/' + Math.round(bookData.total_shares_bid) + ' shares';
    }
    html += '</div>';

    // Individual log rows (Level 3) - initially hidden
    html += '<div id="' + bookId + '" style="display: none; padding-left: 12px;">';
    html += '<table style="width: 100%; font-size: 11px; background: #0e1117; border-collapse: collapse;">';
    html += '<thead><tr style="color: #666; border-bottom: 1px solid #333;">';
    html += '<th style="text-align: left; padding: 3px 6px;">date</th>';
    html += '<th style="text-align: right; padding: 3px 6px;">bid $</th>';
    html += '<th style="text-align: right; padding: 3px 6px;">filled $</th>';
    if (isPM) html += '<th style="text-align: right; padding: 3px 6px;">shares</th>';
    html += '<th style="text-align: right; padding: 3px 6px;">odds</th>';
    if (isPM) html += '<th style="text-align: right; padding: 3px 6px;">bid price</th>';
    html += '<th style="text-align: right; padding: 3px 6px;">actions</th>';
    html += '</tr></thead><tbody>';

    for (const log of bookData.bet_logs) {
      html += renderLogRow(log, betId, isPM);
    }

    html += '</tbody></table></div></div>';
  }

  container.innerHTML = html || '<span style="color: #666;">no logs</span>';
}

function renderLogRow(log, betId, isPM) {
  const logDate = log.timestamp ? new Date(log.timestamp) : null;
  const dateStr = logDate
    ? logDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' +
      logDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
    : '--';

  const logOdds = log.odds >= 2.0
    ? '+' + ((log.odds - 1) * 100).toFixed(1)
    : log.odds > 1 ? (-100 / (log.odds - 1)).toFixed(1) : '--';

  const stakeStr = '$' + (log.stake_added || 0).toFixed(2);
  const filledStr = '$' + (log.filled_added || 0).toFixed(2);
  const bidPriceStr = log.bid_price ? log.bid_price.toFixed(2) + '%' : '--';

  const sharesBid = log.shares_bid ? Math.round(log.shares_bid) : 0;
  const sharesFilled = log.shares_filled ? Math.round(log.shares_filled) : 0;
  const sharesStr = sharesFilled + '/' + sharesBid;

  const isFinalized = log.is_finalized ? true : false;
  const rowBg = isFinalized ? 'background: #1a1a22;' : '';

  let html = '<tr style="border-bottom: 1px solid #222; ' + rowBg + '">';
  html += '<td style="padding: 3px 6px; color: #aaa;">' + dateStr;
  if (isFinalized) html += ' <span style="color: #666; font-size: 9px;">[fin]</span>';
  html += '</td>';
  html += '<td style="text-align: right; padding: 3px 6px;">' + stakeStr + '</td>';
  html += '<td style="text-align: right; padding: 3px 6px; color: ' + ((log.filled_added || 0) > 0 ? '#4caf50' : '#666') + ';">' + filledStr + '</td>';
  if (isPM) html += '<td style="text-align: right; padding: 3px 6px; color: #888;">' + sharesStr + '</td>';
  html += '<td style="text-align: right; padding: 3px 6px;">' + logOdds + '</td>';
  if (isPM) html += '<td style="text-align: right; padding: 3px 6px; color: #888;">' + bidPriceStr + '</td>';

  // Actions column
  html += '<td style="text-align: right; padding: 3px 6px; white-space: nowrap;">';

  if (isPM) {
    if (!isFinalized) {
      html += '<button onclick="event.stopPropagation(); finalizeBetLog(' + log.id + ', ' + betId + ')" style="padding: 1px 4px; font-size: 9px; background: #555; color: #ccc; border: none; border-radius: 2px; cursor: pointer; margin-right: 2px;">fin</button>';
      // Fill button for partially filled PM logs
      if (sharesBid > 0 && sharesFilled < sharesBid) {
        html += '<button onclick="event.stopPropagation(); fillPMBetLog(' + log.id + ', ' + betId + ', ' + sharesBid + ', ' + sharesFilled + ', ' + (log.bid_price || 0) + ')" style="padding: 1px 4px; font-size: 9px; background: #e6a817; color: #000; border: none; border-radius: 2px; cursor: pointer; margin-right: 2px;">fill</button>';
      }
    } else {
      html += '<button onclick="event.stopPropagation(); unfinalizeBetLog(' + log.id + ', ' + betId + ')" style="padding: 1px 4px; font-size: 9px; background: #444; color: #999; border: none; border-radius: 2px; cursor: pointer; margin-right: 2px;">unfin</button>';
    }
  }

  // Update filled button (for any log type)
  if (!isFinalized) {
    html += '<button onclick="event.stopPropagation(); editBetLogFilled(' + log.id + ', ' + betId + ')" style="padding: 1px 4px; font-size: 9px; background: #4a90d9; color: #fff; border: none; border-radius: 2px; cursor: pointer; margin-right: 2px;">edit</button>';
  }

  // Delete button
  html += '<button onclick="event.stopPropagation(); deleteLogEntry(' + log.id + ', ' + betId + ')" style="padding: 1px 4px; font-size: 9px; background: #ff4b4b; color: #fff; border: none; border-radius: 2px; cursor: pointer;">[x]</button>';

  html += '</td></tr>';

  if (log.notes) {
    html += '<tr style="border: none;"><td colspan="' + (isPM ? 7 : 5) + '" style="padding: 0 6px 3px 6px; color: #555; font-size: 10px; font-style: italic;">' + log.notes + '</td></tr>';
  }

  return html;
}

// ============================================================
// Toggle Book (expand/collapse within a bet)
// ============================================================

function toggleBook(bookId) {
  const el = document.getElementById(bookId);
  if (!el) return;
  if (el.style.display === 'none') {
    el.style.display = 'block';
    expandedBooks.add(bookId);
  } else {
    el.style.display = 'none';
    expandedBooks.delete(bookId);
  }
}

// ============================================================
// Fill Management
// ============================================================

async function finalizeBetLog(logId, betId) {
  try {
    const resp = await fetch('/finalize_bet_log/' + logId, { method: 'POST' });
    const data = await resp.json();
    if (!data.success) throw new Error(data.error);
    loadedLogs.delete(betId);
    await loadActiveBets();
  } catch (e) {
    alert('error finalizing: ' + e.message);
  }
}

async function unfinalizeBetLog(logId, betId) {
  try {
    const resp = await fetch('/unfinalize_bet_log/' + logId, { method: 'POST' });
    const data = await resp.json();
    if (!data.success) throw new Error(data.error);
    loadedLogs.delete(betId);
    await loadActiveBets();
  } catch (e) {
    alert('error unfinalizing: ' + e.message);
  }
}

async function fillPMBetLog(logId, betId, sharesBid, sharesFilled, bidPrice) {
  const remaining = Math.round(sharesBid - sharesFilled);
  const input = prompt(
    'shares filled?\n\nbid: ' + Math.round(sharesBid) + ' @ ' + bidPrice.toFixed(2) + '%\n' +
    'already filled: ' + Math.round(sharesFilled) + '\nremaining: ' + remaining,
    remaining
  );
  if (input === null) return;

  const newFilled = parseFloat(input);
  if (isNaN(newFilled) || newFilled <= 0) {
    alert('enter a valid number');
    return;
  }

  const totalFilled = sharesFilled + newFilled;
  if (totalFilled > sharesBid) {
    if (!confirm('total filled (' + Math.round(totalFilled) + ') exceeds bid (' + Math.round(sharesBid) + '). continue?')) return;
  }

  const newFilledDollar = totalFilled * (bidPrice / 100);

  try {
    const resp = await fetch('/update_bet_log/' + logId, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ field: 'filled_added', value: newFilledDollar })
    });
    const data = await resp.json();
    if (!data.success) throw new Error(data.error);

    // Also update shares_filled
    await fetch('/update_bet_log/' + logId, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ field: 'shares_filled', value: totalFilled })
    });

    loadedLogs.delete(betId);
    await loadActiveBets();
  } catch (e) {
    alert('error filling: ' + e.message);
  }
}

function editBetLogFilled(logId, betId) {
  const input = prompt('new filled amount ($):');
  if (input === null) return;

  const value = parseFloat(input);
  if (isNaN(value) || value < 0) {
    alert('enter a valid amount');
    return;
  }

  updateBetLogField(logId, betId, 'filled_added', value);
}

async function updateBetLogField(logId, betId, field, value) {
  try {
    const resp = await fetch('/update_bet_log/' + logId, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ field: field, value: value })
    });
    const data = await resp.json();
    if (!data.success) throw new Error(data.error);
    loadedLogs.delete(betId);
    await loadActiveBets();
  } catch (e) {
    alert('error updating: ' + e.message);
  }
}

// ============================================================
// Delete Log Entry
// ============================================================

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

// ============================================================
// Tournament Toggle
// ============================================================

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
