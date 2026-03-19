// bracket.js - interactive bracket rendering and pick management

// State: picks[region][roundIndex][matchupIndex] = team name or null
// Rounds: 0=R64 (8 matchups), 1=R32 (4), 2=S16 (2), 3=E8 (1), 4=F4 winner
let bracketPicks = {};
let currentBracketRegion = 'east';

const BRACKET_ROUNDS = [
  { key: 'r32', label: 'r64', count: 8 },
  { key: 's16', label: 'r32', count: 4 },
  { key: 'e8', label: 's16', count: 2 },
  { key: 'f4', label: 'e8', count: 1 },
  { key: 'championship', label: 'f4', count: 1 }
];

// The round key for fair odds lookup when a team advances TO that round
const ADVANCE_ROUND_KEY = ['r32', 's16', 'e8', 'f4', 'championship'];

function initBracket() {
  // Initialize picks from sessionStorage or fresh
  const saved = sessionStorage.getItem('bracketPicks');
  if (saved) {
    try { bracketPicks = JSON.parse(saved); } catch(e) { bracketPicks = {}; }
  }

  ['east', 'west', 'south', 'midwest'].forEach(r => {
    if (!bracketPicks[r]) bracketPicks[r] = {};
  });

  renderBracketRegion(currentBracketRegion);
  updateBracketRegionButtons();
}

function saveBracketPicks() {
  sessionStorage.setItem('bracketPicks', JSON.stringify(bracketPicks));
}

function switchBracketRegion(region) {
  currentBracketRegion = region;
  renderBracketRegion(region);
  updateBracketRegionButtons();
}

function updateBracketRegionButtons() {
  document.querySelectorAll('.bracket-region-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.region === currentBracketRegion);
  });
}

// ============================================================
// Main render
// ============================================================

function renderBracketRegion(region) {
  const container = document.getElementById('bracket-content');
  if (!container) return;

  const data = NCAA_BRACKET.regions[region];
  if (!data) { container.innerHTML = 'unknown region'; return; }

  const picks = bracketPicks[region] || {};

  let html = '<div class="bracket-grid">';

  // Column 0: R64 (first round) - 8 matchups
  html += '<div class="bracket-col">';
  html += '<div class="bracket-col-label">round of 64</div>';
  data.matchups.forEach((m, i) => {
    html += renderMatchup(region, 0, i, m.team1, m.seed1, m.team2, m.seed2, picks);
  });
  html += '</div>';

  // Columns 1-3: R32, S16, E8
  const roundLabels = ['round of 32', 'sweet 16', 'elite 8'];
  for (let round = 1; round <= 3; round++) {
    const count = BRACKET_ROUNDS[round].count;
    html += '<div class="bracket-col">';
    html += '<div class="bracket-col-label">' + roundLabels[round - 1] + '</div>';
    for (let i = 0; i < count; i++) {
      const team1 = getAdvancedTeam(region, round, i * 2, picks);
      const team2 = getAdvancedTeam(region, round, i * 2 + 1, picks);
      const seed1 = team1 ? getTeamSeed(team1) : null;
      const seed2 = team2 ? getTeamSeed(team2) : null;
      html += renderMatchup(region, round, i, team1, seed1, team2, seed2, picks);
    }
    html += '</div>';
  }

  // Column 4: Region winner (F4 slot)
  html += '<div class="bracket-col">';
  html += '<div class="bracket-col-label">final four</div>';
  const f4Winner = getAdvancedTeam(region, 4, 0, picks);
  const f4Seed = f4Winner ? getTeamSeed(f4Winner) : null;
  html += '<div class="bracket-matchup bracket-winner-slot">';
  if (f4Winner) {
    const fairRound = 'f4';
    const prob = getTeamFair(f4Winner, fairRound);
    const pctStr = prob ? (prob * 100).toFixed(1) + '%' : '--';
    const oddsStr = prob ? formatFairOddsShort(prob) : '--';
    html += '<div class="bracket-team bracket-advanced" onclick="openBracketBet(\'' + esc(f4Winner) + '\', \'' + fairRound + '\')">';
    html += '<span class="bracket-seed">' + f4Seed + '</span> ';
    html += '<span class="bracket-team-name">' + f4Winner + '</span>';
    html += '<span class="bracket-fair">' + pctStr + ' / ' + oddsStr + '</span>';
    html += '<span class="bracket-clear" onclick="event.stopPropagation(); clearPick(\'' + region + '\', 3, 0)">x</span>';
    html += '</div>';
  } else {
    html += '<div class="bracket-team bracket-empty">--</div>';
  }
  html += '</div>';
  html += '</div>';

  html += '</div>';
  container.innerHTML = html;
}

// ============================================================
// Matchup rendering
// ============================================================

function renderMatchup(region, round, index, team1, seed1, team2, seed2, picks) {
  const winner = picks[round] ? picks[round][index] : null;
  const roundKey = ADVANCE_ROUND_KEY[round]; // fair odds round for this matchup's winner

  let html = '<div class="bracket-matchup" data-round="' + round + '" data-index="' + index + '">';

  // Team 1 slot
  html += renderTeamSlot(region, round, index, team1, seed1, roundKey, winner, 'top');

  // Divider
  html += '<div class="bracket-vs">vs</div>';

  // Team 2 slot
  html += renderTeamSlot(region, round, index, team2, seed2, roundKey, winner, 'bottom');

  html += '</div>';
  return html;
}

function renderTeamSlot(region, round, index, team, seed, roundKey, winner, position) {
  if (!team) {
    return '<div class="bracket-team bracket-empty">--</div>';
  }

  const isWinner = winner === team;
  const isLoser = winner && !isWinner;
  const prob = getTeamFair(team, roundKey);
  const pctStr = prob ? (prob * 100).toFixed(1) + '%' : '--';
  const oddsStr = prob ? formatFairOddsShort(prob) : '--';

  let cls = 'bracket-team';
  if (isWinner) cls += ' bracket-advanced';
  if (isLoser) cls += ' bracket-eliminated';

  let html = '<div class="' + cls + '" onclick="advanceTeam(\'' + region + '\', ' + round + ', ' + index + ', \'' + esc(team) + '\')">';
  html += '<span class="bracket-seed">' + seed + '</span> ';
  html += '<span class="bracket-team-name">' + team + '</span>';
  html += '<span class="bracket-fair">' + pctStr + ' / ' + oddsStr + '</span>';

  if (isWinner) {
    html += '<span class="bracket-clear" onclick="event.stopPropagation(); clearPick(\'' + region + '\', ' + round + ', ' + index + ')">x</span>';
  }

  html += '</div>';
  return html;
}

// ============================================================
// Advance / Clear logic
// ============================================================

function advanceTeam(region, round, matchupIndex, team) {
  if (!bracketPicks[region]) bracketPicks[region] = {};
  if (!bracketPicks[region][round]) bracketPicks[region][round] = {};

  // If already picked this team, do nothing
  if (bracketPicks[region][round][matchupIndex] === team) return;

  // Set pick
  bracketPicks[region][round][matchupIndex] = team;

  // Clear all downstream picks that depended on the old winner
  clearDownstream(region, round + 1, Math.floor(matchupIndex / 2));

  saveBracketPicks();
  renderBracketRegion(region);
}

function clearPick(region, round, matchupIndex) {
  if (!bracketPicks[region] || !bracketPicks[region][round]) return;

  delete bracketPicks[region][round][matchupIndex];

  // Clear downstream
  clearDownstream(region, round + 1, Math.floor(matchupIndex / 2));

  saveBracketPicks();
  renderBracketRegion(region);
}

function clearDownstream(region, fromRound, fromIndex) {
  for (let r = fromRound; r <= 4; r++) {
    if (bracketPicks[region] && bracketPicks[region][r]) {
      delete bracketPicks[region][r][fromIndex];
    }
    fromIndex = Math.floor(fromIndex / 2);
  }
}

// ============================================================
// Helpers
// ============================================================

function getAdvancedTeam(region, round, sourceIndex, picks) {
  // For round N, the team comes from picks at round N-1
  const prevRound = round - 1;
  if (prevRound < 0) return null;
  if (!picks[prevRound]) return null;

  // sourceIndex in the previous round
  const matchupIndex = Math.floor(sourceIndex / 2);
  // But we need: which team won matchup sourceIndex in the previous round
  return picks[prevRound][sourceIndex] || null;
}

function getTeamSeed(teamName) {
  const team = NCAA_FAIRS.find(t => t.team === teamName);
  return team ? team.seed : '?';
}

function formatFairOddsShort(prob) {
  if (!prob || prob <= 0 || prob >= 1) return '--';
  if (prob >= 0.5) return String(Math.round(-100 * prob / (1 - prob)));
  return '+' + Math.round(100 * (1 - prob) / prob);
}

function esc(str) {
  return str.replace(/'/g, "\\'");
}

function openBracketBet(team, roundKey) {
  showLogBetModal({ team: team, round: roundKey });
}
