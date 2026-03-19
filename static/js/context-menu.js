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
  if (e.target.closest('.bet-row') || e.target.closest('[data-context-menu]')) {
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
