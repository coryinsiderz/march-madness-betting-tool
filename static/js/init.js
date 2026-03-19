// init.js - initialization, bankroll loading, fairs table rendering

document.addEventListener('DOMContentLoaded', () => {
  loadBankroll();
  restoreFairsMode();
  renderFairsTable();

  // Restore last active tab
  const savedTab = sessionStorage.getItem('activeTab') || 'fairs';
  showTab(savedTab);

  // Bankroll input: save on blur or enter
  const brInput = document.getElementById('bankroll-value');
  if (brInput) {
    brInput.addEventListener('focus', function() { this.select(); });
    brInput.addEventListener('blur', saveBankroll);
    brInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') { this.blur(); }
    });
  }
});

async function loadBankroll() {
  try {
    const resp = await fetch('/get_bankroll');
    const data = await resp.json();
    if (data.success) {
      const input = document.getElementById('bankroll-value');
      if (input) {
        input.value = '$' + data.bankroll.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      }
    }
  } catch (e) {
    console.error('bankroll load error:', e);
  }
}

async function saveBankroll() {
  const input = document.getElementById('bankroll-value');
  if (!input) return;
  const val = parseFloat(input.value.replace(/[,$]/g, ''));
  if (isNaN(val)) return;

  try {
    const resp = await fetch('/set_bankroll', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bankroll: val })
    });
    const data = await resp.json();
    if (data.success) {
      input.value = '$' + data.bankroll.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
  } catch (e) {
    console.error('bankroll save error:', e);
  }
}

// Fairs table rendering
let fairsSortColumn = 'win_title';
let fairsSortAscending = false;
let fairsRegionFilter = 'all';
let fairsSearchFilter = '';

function renderFairsTable() {
  const tbody = document.getElementById('fairs-tbody');
  if (!tbody) return;

  let teams = [...NCAA_FAIRS];

  // Apply region filter
  if (fairsRegionFilter !== 'all') {
    teams = teams.filter(t => t.region === fairsRegionFilter);
  }

  // Apply search filter
  if (fairsSearchFilter) {
    const search = fairsSearchFilter.toLowerCase();
    teams = teams.filter(t => t.team.toLowerCase().includes(search));
  }

  // Sort
  teams.sort((a, b) => {
    const valA = a[fairsSortColumn] || 0;
    const valB = b[fairsSortColumn] || 0;
    if (typeof valA === 'number' && typeof valB === 'number') {
      return fairsSortAscending ? valA - valB : valB - valA;
    }
    return fairsSortAscending ? String(valA).localeCompare(String(valB)) : String(valB).localeCompare(String(valA));
  });

  const rounds = ['r32', 's16', 'e8', 'f4', 'championship', 'win_title'];

  let html = '';
  teams.forEach(team => {
    html += '<tr>';
    html += '<td>' + team.team + '</td>';
    html += '<td>' + team.seed + '</td>';
    html += '<td style="color:#888; font-size:11px">' + team.region + '</td>';

    rounds.forEach(round => {
      const prob = team[round];
      const pct = (prob * 100).toFixed(1);
      let american = '--';

      if (prob > 0 && prob < 1) {
        if (prob >= 0.5) {
          american = String(Math.round(-100 * prob / (1 - prob)));
        } else {
          american = '+' + Math.round(100 * (1 - prob) / prob);
        }
      } else if (prob >= 1) {
        american = '--';
      }

      const escapedTeam = team.team.replace(/'/g, "\\'");
      const clickable = prob > 0 ? ' class="fairs-cell" onclick="showLogBetModal({team:\'' + escapedTeam + '\', round:\'' + round + '\'})"' : '';

      html += '<td' + clickable + ' style="text-align:right;">';
      if (prob > 0) {
        html += '<span class="fair-val">';
        html += '<span class="fair-pct">' + pct + '%</span>';
        html += '<span class="fair-odds">' + american + '</span>';
        html += '</span>';
      } else {
        html += '<span style="color:#555">--</span>';
      }
      html += '</td>';
    });

    html += '</tr>';
  });

  tbody.innerHTML = html;

  // Update sort indicators
  document.querySelectorAll('#fairs-table th').forEach(th => {
    th.classList.remove('sort-asc', 'sort-desc');
    if (th.dataset.sort === fairsSortColumn) {
      th.classList.add(fairsSortAscending ? 'sort-asc' : 'sort-desc');
    }
  });
}

function sortFairs(column) {
  if (fairsSortColumn === column) {
    fairsSortAscending = !fairsSortAscending;
  } else {
    fairsSortColumn = column;
    fairsSortAscending = false;
  }
  renderFairsTable();
}

function filterFairsRegion(region) {
  fairsRegionFilter = region;
  renderFairsTable();
}

function filterFairsSearch(query) {
  fairsSearchFilter = query;
  renderFairsTable();
}

function toggleFairsMode() {
  const table = document.getElementById('fairs-table');
  const btn = document.getElementById('fairs-mode-btn');
  if (table.classList.contains('prob-mode')) {
    table.classList.remove('prob-mode');
    btn.textContent = 'odds';
    sessionStorage.setItem('fairsDisplayMode', 'odds');
  } else {
    table.classList.add('prob-mode');
    btn.textContent = 'prob';
    sessionStorage.setItem('fairsDisplayMode', 'prob');
  }
}

function restoreFairsMode() {
  const mode = sessionStorage.getItem('fairsDisplayMode');
  if (mode === 'prob') {
    const table = document.getElementById('fairs-table');
    const btn = document.getElementById('fairs-mode-btn');
    if (table) table.classList.add('prob-mode');
    if (btn) btn.textContent = 'prob';
  }
}
