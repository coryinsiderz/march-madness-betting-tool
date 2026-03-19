// context-menu.js - context menu infrastructure, event management

let contextMenuTarget = null;

// Create context menu element
const _ctxHtml = '<div id="context-menu" class="context-menu"></div>';
document.body.insertAdjacentHTML('beforeend', _ctxHtml);

// Hide context menu on click anywhere
document.addEventListener('click', () => {
  document.getElementById('context-menu').style.display = 'none';
});

// Prevent default context menu on tracked elements
document.addEventListener('contextmenu', (e) => {
  if (e.target.closest('.bet-row') || e.target.closest('[data-context-menu]') || e.target.closest('.bracket-team:not(.bracket-empty)')) {
    e.preventDefault();
  }
});

// Event context menu
function showEventContextMenu(e, data) {
  e.preventDefault();
  e.stopPropagation();

  contextMenuTarget = data;

  const contextMenu = document.getElementById('context-menu');
  let menuItems = '';

  menuItems += '<div class="context-menu-item" onclick="archiveEventAction()">' + (data.isArchived ? 'restore' : 'archive') + '</div>';
  menuItems += '<div class="context-menu-item" style="color: #ff4b4b;" onclick="deleteEventAction()">delete</div>';

  contextMenu.innerHTML = menuItems;
  contextMenu.style.display = 'block';
  contextMenu.style.position = 'fixed';
  contextMenu.style.left = e.clientX + 'px';
  contextMenu.style.top = e.clientY + 'px';
}

async function archiveEventAction() {
  if (!contextMenuTarget) return;
  document.getElementById('context-menu').style.display = 'none';

  try {
    const resp = await fetch('/archive_event/' + contextMenuTarget.eventId, { method: 'POST' });
    const data = await resp.json();
    if (data.success) {
      loadActiveBets();
    } else {
      alert('error: ' + data.error);
    }
  } catch (e) {
    alert('error: ' + e.message);
  }
}

async function deleteEventAction() {
  if (!contextMenuTarget) return;
  document.getElementById('context-menu').style.display = 'none';

  if (!confirm('delete event "' + contextMenuTarget.eventName + '"?')) return;

  try {
    const resp = await fetch('/delete_event/' + contextMenuTarget.eventId, { method: 'DELETE' });
    const data = await resp.json();
    if (data.success) {
      loadActiveBets();
    } else {
      alert('error: ' + data.error);
    }
  } catch (e) {
    alert('error: ' + e.message);
  }
}

// ============================================================
// Bracket Context Menu
// ============================================================

// Round key -> market type for log bet
const BRACKET_ROUND_TO_MARKET = {
  'r32': 'reach_r32',
  's16': 'reach_s16',
  'e8': 'reach_e8',
  'f4': 'reach_f4',
  'championship': 'reach_championship',
  'win_title': 'win_title'
};

function showBracketContextMenu(e, data) {
  e.preventDefault();
  e.stopPropagation();

  contextMenuTarget = data;

  const contextMenu = document.getElementById('context-menu');
  let menuItems = '';

  // "advance" — only if not already advanced
  if (!data.isAdvanced) {
    if (data.isFF) {
      menuItems += '<div class="context-menu-item" onclick="bracketCtxAdvanceFF()">advance</div>';
    } else {
      menuItems += '<div class="context-menu-item" onclick="bracketCtxAdvance()">advance</div>';
    }
  }

  // "log bet"
  menuItems += '<div class="context-menu-item" onclick="bracketCtxLogBet()">log bet</div>';

  // "send back" — only if this team was advanced (is a winner in its matchup)
  if (data.isAdvanced) {
    if (data.isFF) {
      menuItems += '<div class="context-menu-item" style="color:#ff4b4b;" onclick="bracketCtxSendBackFF()">send back</div>';
    } else {
      menuItems += '<div class="context-menu-item" style="color:#ff4b4b;" onclick="bracketCtxSendBack()">send back</div>';
    }
  }

  contextMenu.innerHTML = menuItems;
  contextMenu.style.display = 'block';
  contextMenu.style.position = 'fixed';
  contextMenu.style.left = e.clientX + 'px';
  contextMenu.style.top = e.clientY + 'px';
}

function bracketCtxAdvance() {
  if (!contextMenuTarget) return;
  document.getElementById('context-menu').style.display = 'none';
  advanceTeam(contextMenuTarget.region, contextMenuTarget.round, contextMenuTarget.index, contextMenuTarget.team);
}

function bracketCtxAdvanceFF() {
  if (!contextMenuTarget) return;
  document.getElementById('context-menu').style.display = 'none';
  advanceFF(contextMenuTarget.round, contextMenuTarget.index, contextMenuTarget.team);
}

function bracketCtxLogBet() {
  if (!contextMenuTarget) return;
  document.getElementById('context-menu').style.display = 'none';
  const marketRoundKey = contextMenuTarget.roundKey;
  const round = Object.keys(ROUND_TO_MARKET_TYPE).find(k => ROUND_TO_MARKET_TYPE[k] === BRACKET_ROUND_TO_MARKET[marketRoundKey]) || marketRoundKey;
  showLogBetModal({ team: contextMenuTarget.team, round: round });
}

function bracketCtxSendBack() {
  if (!contextMenuTarget) return;
  document.getElementById('context-menu').style.display = 'none';
  clearPick(contextMenuTarget.region, contextMenuTarget.round, contextMenuTarget.index);
}

function bracketCtxSendBackFF() {
  if (!contextMenuTarget) return;
  document.getElementById('context-menu').style.display = 'none';
  clearFFPick(contextMenuTarget.round, contextMenuTarget.index);
}
