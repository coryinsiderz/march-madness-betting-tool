// utils.js - shared utility functions

function decimalToAmerican(decimal) {
  if (decimal >= 2.0) {
    return '+' + Math.round((decimal - 1) * 100);
  }
  return String(Math.round(-100 / (decimal - 1)));
}

function americanToDecimal(american) {
  const odds = parseFloat(String(american).replace('+', ''));
  if (isNaN(odds)) return null;
  if (odds >= 0) return (odds / 100) + 1;
  return (100 / Math.abs(odds)) + 1;
}

function americanToPercentage(american) {
  const odds = parseFloat(String(american).replace('+', ''));
  if (isNaN(odds)) return null;
  if (odds >= 0) return (100 / (odds + 100)) * 100;
  return (Math.abs(odds) / (Math.abs(odds) + 100)) * 100;
}

function percentageToAmerican(pct) {
  const percent = parseFloat(pct);
  if (isNaN(percent) || percent <= 0 || percent >= 100) return null;
  if (percent >= 50) return Math.round(-percent / (100 - percent) * 100);
  return '+' + Math.round((100 - percent) / percent * 100);
}

function percentageToDecimal(pct) {
  const percent = parseFloat(pct);
  if (isNaN(percent) || percent <= 0) return null;
  return 100 / percent;
}

function formatAmericanOdds(value) {
  if (value === null || value === undefined) return '--';
  const num = typeof value === 'number' ? value : parseFloat(value);
  if (isNaN(num)) return '--';
  return num > 0 ? '+' + Math.round(num) : String(Math.round(num));
}

function formatProbability(prob) {
  if (!prob || prob <= 0) return '--';
  return (prob * 100).toFixed(1) + '%';
}

function normalizeBookName(raw) {
  if (!raw) return raw;
  const key = raw.trim().toLowerCase();
  const abbr = BOOK_ABBR_MAP[key] || key;
  return BOOK_DISPLAY_MAP[abbr] || raw;
}

function getBookAbbr(bookName) {
  if (!bookName) return '';
  const lower = bookName.toLowerCase();
  return BOOK_ABBR_MAP[lower] || lower.slice(0, 3);
}

// Calculate Kelly bet size
function calculateKellyBet(fairDecimal, bookDecimal) {
  if (!fairDecimal || !bookDecimal || fairDecimal <= 1 || bookDecimal <= 1) return 0;

  const bankrollEl = document.getElementById('bankroll-value');
  const bankroll = bankrollEl ? parseFloat(bankrollEl.value.replace(/[$,]/g, '')) || 40000 : 40000;

  const winProb = 1 / fairDecimal;
  const b = bookDecimal - 1;
  const kellyFull = (winProb * b - (1 - winProb)) / b;

  if (kellyFull <= 0) return 0;
  return Math.round(bankroll * kellyFull * KELLY_FRACTION * 100) / 100;
}

// Calculate edge percentage
function calculateEdge(fairDecimal, bookDecimal) {
  if (!fairDecimal || !bookDecimal) return 0;
  return ((bookDecimal / fairDecimal) - 1) * 100;
}

// Make table sortable by clicking headers
function makeTableSortable(tableId) {
  const table = document.getElementById(tableId);
  if (!table) return;

  const headers = table.querySelectorAll('th');
  const tbody = table.querySelector('tbody');
  if (!tbody) return;

  const isTrackingTable = table.classList.contains('tracking-bet-table');
  const ascendingState = {};

  headers.forEach((header, columnIndex) => {
    ascendingState[columnIndex] = true;
    header.style.cursor = 'pointer';

    header.addEventListener('click', () => {
      let rows;
      let logsRows = {};

      if (isTrackingTable) {
        rows = Array.from(tbody.querySelectorAll('tr.bet-row'));
        rows.forEach(row => {
          const betId = row.id?.replace('bet-row-', '');
          if (betId) {
            const logsRow = document.getElementById('bet-logs-' + betId);
            if (logsRow) logsRows[betId] = logsRow;
          }
        });
      } else {
        rows = Array.from(tbody.querySelectorAll('tr'));
      }

      const ascending = ascendingState[columnIndex];

      rows.sort((a, b) => {
        const cellA = a.cells[columnIndex]?.textContent.trim() || '';
        const cellB = b.cells[columnIndex]?.textContent.trim() || '';

        const numA = parseFloat(cellA.replace(/[%$+,]/g, ''));
        const numB = parseFloat(cellB.replace(/[%$+,]/g, ''));

        if (!isNaN(numA) && !isNaN(numB)) {
          return ascending ? numA - numB : numB - numA;
        }
        return ascending ? cellA.localeCompare(cellB) : cellB.localeCompare(cellA);
      });

      while (tbody.firstChild) tbody.removeChild(tbody.firstChild);

      rows.forEach(row => {
        tbody.appendChild(row);
        if (isTrackingTable) {
          const betId = row.id?.replace('bet-row-', '');
          if (betId && logsRows[betId]) tbody.appendChild(logsRows[betId]);
        }
      });

      headers.forEach(h => h.classList.remove('sort-asc', 'sort-desc'));
      header.classList.add(ascending ? 'sort-asc' : 'sort-desc');
      ascendingState[columnIndex] = !ascending;
    });
  });
}

function formatTimeAgo(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return diffMins + 'm ago';
  if (diffHours < 24) return diffHours + 'h ago';
  return diffDays + 'd ago';
}
