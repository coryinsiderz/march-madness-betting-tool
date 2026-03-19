// grading.js - bet grading, deletion, context menu handling

// Mobile long-press support
(function() {
  let longPressTimer = null;
  let touchStartPos = null;
  const LONG_PRESS_MS = 500;
  const MOVE_THRESHOLD = 10;

  document.addEventListener('touchstart', (e) => {
    const row = e.target.closest('.bet-row');
    if (!row) return;
    touchStartPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    longPressTimer = setTimeout(() => {
      e.preventDefault();
      const betId = parseInt(row.id.replace('bet-row-', ''));
      const syntheticEvent = {
        preventDefault: () => {},
        stopPropagation: () => {},
        target: e.target,
        clientX: touchStartPos.x,
        clientY: touchStartPos.y
      };
      handleBetRowContextMenu(syntheticEvent, betId, row);
    }, LONG_PRESS_MS);
  }, { passive: false });

  document.addEventListener('touchmove', (e) => {
    if (!longPressTimer || !touchStartPos) return;
    const dx = e.touches[0].clientX - touchStartPos.x;
    const dy = e.touches[0].clientY - touchStartPos.y;
    if (Math.sqrt(dx * dx + dy * dy) > MOVE_THRESHOLD) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  });

  document.addEventListener('touchend', () => {
    if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
  });

  document.addEventListener('touchcancel', () => {
    if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
  });
})();

// Handle right-click on bet row
function handleBetRowContextMenu(e, betId, rowEl) {
  e.preventDefault();
  e.stopPropagation();

  let betData;
  try {
    betData = JSON.parse(rowEl.dataset?.bet || rowEl.getAttribute('data-bet'));
  } catch (err) {
    console.error('failed to parse bet data:', err);
    return;
  }

  const contextMenu = document.getElementById('context-menu');
  let menuItems = '';

  if (betData.status === 'Open') {
    menuItems += '<div class="context-menu-item" onclick="gradeBet(' + betId + ', \'Won\')">won</div>';
    menuItems += '<div class="context-menu-item" onclick="gradeBet(' + betId + ', \'Lost\')">lost</div>';
    menuItems += '<div class="context-menu-item" onclick="gradeBet(' + betId + ', \'Push\')">push</div>';
    menuItems += '<div class="context-menu-item" onclick="gradeBetDeadHeat(' + betId + ')">dead heat</div>';
    menuItems += '<div class="context-menu-separator"></div>';
  } else if (betData.status === 'Closed' && betData.result !== 'Sold') {
    menuItems += '<div class="context-menu-item" onclick="ungradeBet(' + betId + ')">ungrade</div>';
    menuItems += '<div class="context-menu-separator"></div>';
  }

  menuItems += '<div class="context-menu-item" style="color: #ff4b4b;" onclick="deleteBet(' + betId + ')">delete</div>';

  contextMenu.innerHTML = menuItems;
  contextMenu.style.display = 'block';
  contextMenu.style.position = 'fixed';
  contextMenu.style.left = (e.clientX || e.pageX) + 'px';
  contextMenu.style.top = (e.clientY || e.pageY) + 'px';

  // Clamp to viewport
  const rect = contextMenu.getBoundingClientRect();
  if (rect.bottom > window.innerHeight) {
    contextMenu.style.top = ((e.clientY || e.pageY) - rect.height) + 'px';
  }
  if (rect.right > window.innerWidth) {
    contextMenu.style.left = ((e.clientX || e.pageX) - rect.width) + 'px';
  }
}

async function gradeBet(betId, result) {
  document.getElementById('context-menu').style.display = 'none';

  try {
    const resp = await fetch('/grade_bet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bet_id: betId, result: result })
    });
    const data = await resp.json();
    if (data.success) {
      loadedLogs.delete(betId);
      loadActiveBets();
      if (typeof loadBankroll === 'function') loadBankroll();
    } else {
      alert('error: ' + data.error);
    }
  } catch (e) {
    alert('error: ' + e.message);
  }
}

async function gradeBetDeadHeat(betId) {
  document.getElementById('context-menu').style.display = 'none';

  const adjustedOdds = prompt('enter adjusted decimal odds for dead heat (or leave blank for half-odds):');
  const payload = { bet_id: betId, result: 'Dead Heat' };
  if (adjustedOdds && !isNaN(parseFloat(adjustedOdds))) {
    payload.adjusted_odds = parseFloat(adjustedOdds);
  }

  try {
    const resp = await fetch('/grade_bet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await resp.json();
    if (data.success) {
      loadedLogs.delete(betId);
      loadActiveBets();
      if (typeof loadBankroll === 'function') loadBankroll();
    } else {
      alert('error: ' + data.error);
    }
  } catch (e) {
    alert('error: ' + e.message);
  }
}

async function ungradeBet(betId) {
  document.getElementById('context-menu').style.display = 'none';

  try {
    const resp = await fetch('/ungrade_bet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bet_id: betId })
    });
    const data = await resp.json();
    if (data.success) {
      loadedLogs.delete(betId);
      loadActiveBets();
      if (typeof loadBankroll === 'function') loadBankroll();
    } else {
      alert('error: ' + data.error);
    }
  } catch (e) {
    alert('error: ' + e.message);
  }
}

async function deleteBet(betId) {
  document.getElementById('context-menu').style.display = 'none';

  if (!confirm('delete this bet? cannot be undone.')) return;

  try {
    const resp = await fetch('/delete_bet/' + betId, { method: 'DELETE' });
    const data = await resp.json();
    if (data.success) {
      loadedLogs.delete(betId);
      expandedBetIds.delete(betId);
      loadActiveBets();
      if (typeof loadBankroll === 'function') loadBankroll();
    } else {
      alert('error: ' + data.error);
    }
  } catch (e) {
    alert('error: ' + e.message);
  }
}
