// bracket.js - interactive bracket rendering, pick management, final four view

// State: picks[region][roundIndex][matchupIndex] = team name or null
// Region rounds: 0=R64 (8 matchups), 1=R32 (4), 2=S16 (2), 3=E8 (1), 4=F4 winner
// Final four: picks.final_four[0][0]=semi1 winner, [0][1]=semi2 winner, [1][0]=champion
let bracketPicks = {};
let currentBracketRegion = 'east';
let bracketPhase = { phase1_locked: false, phase2_locked: false, phase3_locked: false, is_admin: false };

const BRACKET_ROUNDS = [
  { key: 'r32', label: 'r64', count: 8 },
  { key: 's16', label: 'r32', count: 4 },
  { key: 'e8', label: 's16', count: 2 },
  { key: 'f4', label: 'e8', count: 1 },
  { key: 'championship', label: 'f4', count: 1 }
];

// The round key for fair odds lookup when a team advances TO that round
const ADVANCE_ROUND_KEY = ['r32', 's16', 'e8', 'f4', 'championship'];

// Phase lock mapping: which rounds are locked by which phase
// Phase 1 locks: R64 picks (round 0) and R32 picks (round 1)
// Phase 2 locks: S16 picks (round 2) and E8 picks (round 3)
// Phase 3 locks: F4 winner (round 4) and all final_four picks
function isRoundLocked(region, round) {
  if (bracketPhase.is_admin) return false; // admin bypass
  if (region === 'final_four') return bracketPhase.phase3_locked;
  if (round <= 1) return bracketPhase.phase1_locked;
  if (round <= 3) return bracketPhase.phase2_locked;
  return bracketPhase.phase3_locked;
}

function initBracket() {
  // Load from server first, fall back to sessionStorage
  fetch('/api/bracket/load')
    .then(r => r.json())
    .then(data => {
      if (data.success && data.picks && Object.keys(data.picks).length > 0) {
        bracketPicks = data.picks;
      } else {
        const saved = sessionStorage.getItem('bracketPicks');
        if (saved) {
          try { bracketPicks = JSON.parse(saved); } catch(e) { bracketPicks = {}; }
        }
      }
      _finishInitBracket();
    })
    .catch(() => {
      const saved = sessionStorage.getItem('bracketPicks');
      if (saved) {
        try { bracketPicks = JSON.parse(saved); } catch(e) { bracketPicks = {}; }
      }
      _finishInitBracket();
    });

  // Load phase info
  fetch('/api/bracket/phase')
    .then(r => r.json())
    .then(data => {
      if (data.success) {
        bracketPhase = data;
        updatePhaseDisplay();
      }
    })
    .catch(() => {});
}

function _finishInitBracket() {
  ['east', 'west', 'south', 'midwest', 'final_four'].forEach(r => {
    if (!bracketPicks[r]) bracketPicks[r] = {};
  });

  if (currentBracketRegion === 'final_four') {
    renderFinalFour();
  } else {
    renderBracketRegion(currentBracketRegion);
  }
  updateBracketRegionButtons();
}

function updatePhaseDisplay() {
  const el = document.getElementById('bracket-phase-info');
  if (!el) return;
  let parts = [];
  if (bracketPhase.phase1_locked) parts.push('r64/r32 locked');
  if (bracketPhase.phase2_locked) parts.push('s16/e8 locked');
  if (bracketPhase.phase3_locked) parts.push('f4/champ locked');
  if (parts.length === 0) parts.push('all picks open');
  el.textContent = parts.join(' | ');
}

function saveBracketPicks() {
  sessionStorage.setItem('bracketPicks', JSON.stringify(bracketPicks));
  // Persist to server
  fetch('/api/bracket/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ picks: bracketPicks })
  }).catch(err => console.error('bracket save error:', err));
}

function switchBracketRegion(region) {
  currentBracketRegion = region;
  if (region === 'final_four') {
    renderFinalFour();
  } else {
    renderBracketRegion(region);
  }
  updateBracketRegionButtons();
}

function updateBracketRegionButtons() {
  document.querySelectorAll('.bracket-region-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.region === currentBracketRegion);
  });
}

// ============================================================
// Fair odds formatting (split into two styled spans)
// ============================================================

function fairOddsHtml(prob) {
  if (!prob || prob <= 0) return '<span class="bracket-fair"><span class="bracket-fair-odds">--</span></span>';
  const pctStr = (prob * 100).toFixed(1) + '%';
  let oddsStr = '--';
  if (prob > 0 && prob < 1) {
    oddsStr = prob >= 0.5
      ? String(Math.round(-100 * prob / (1 - prob)))
      : '+' + Math.round(100 * (1 - prob) / prob);
  }
  return '<span class="bracket-fair"><span class="bracket-fair-odds">' + oddsStr + '</span><span class="bracket-fair-pct">' + pctStr + '</span></span>';
}

// ============================================================
// Region bracket render
// ============================================================

function renderBracketRegion(region) {
  const container = document.getElementById('bracket-content');
  if (!container) return;

  const data = NCAA_BRACKET.regions[region];
  if (!data) { container.innerHTML = 'unknown region'; return; }

  const picks = bracketPicks[region] || {};

  let html = '<div class="bracket-grid">';

  // Column 0: R64 - 8 matchups
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
    const prob = getTeamFair(f4Winner, 'f4');
    const f4Ctx = '{&quot;region&quot;:&quot;' + region + '&quot;,&quot;round&quot;:3,&quot;index&quot;:0,&quot;team&quot;:&quot;' + esc(f4Winner).replace(/"/g, '&quot;') + '&quot;,&quot;roundKey&quot;:&quot;f4&quot;,&quot;isAdvanced&quot;:true}';
    html += '<div class="bracket-team bracket-advanced" onclick="openBracketBet(\'' + esc(f4Winner) + '\', \'f4\')" oncontextmenu="showBracketContextMenu(event, ' + f4Ctx + ')">';
    html += '<span class="bracket-seed">' + f4Seed + '</span> ';
    html += '<span class="bracket-team-name">' + f4Winner + '</span>';
    html += fairOddsHtml(prob);
    html += '<span class="bracket-clear" onclick="event.stopPropagation(); clearPick(\'' + region + '\', 3, 0)">x</span>';
    html += '</div>';
  } else {
    html += '<div class="bracket-team bracket-empty">tbd</div>';
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
  const roundKey = ADVANCE_ROUND_KEY[round];

  let html = '<div class="bracket-matchup" data-round="' + round + '" data-index="' + index + '">';
  html += renderTeamSlot(region, round, index, team1, seed1, roundKey, winner);
  html += '<div class="bracket-vs">vs</div>';
  html += renderTeamSlot(region, round, index, team2, seed2, roundKey, winner);
  html += '</div>';
  return html;
}

function renderTeamSlot(region, round, index, team, seed, roundKey, winner) {
  if (!team) {
    return '<div class="bracket-team bracket-empty">tbd</div>';
  }

  const isWinner = winner === team;
  const isLoser = winner && !isWinner;
  const prob = getTeamFair(team, roundKey);

  let cls = 'bracket-team';
  if (isWinner) cls += ' bracket-advanced';
  if (isLoser) cls += ' bracket-eliminated';

  // Build context data for right-click
  const ctxData = '{&quot;region&quot;:&quot;' + region + '&quot;,&quot;round&quot;:' + round + ',&quot;index&quot;:' + index + ',&quot;team&quot;:&quot;' + esc(team).replace(/"/g, '&quot;') + '&quot;,&quot;roundKey&quot;:&quot;' + roundKey + '&quot;,&quot;isAdvanced&quot;:' + isWinner + '}';

  let html = '<div class="' + cls + '" onclick="advanceTeam(\'' + region + '\', ' + round + ', ' + index + ', \'' + esc(team) + '\')" oncontextmenu="showBracketContextMenu(event, ' + ctxData + ')">';
  html += '<span class="bracket-seed">' + seed + '</span> ';
  html += '<span class="bracket-team-name">' + team + '</span>';
  html += fairOddsHtml(prob);

  if (isWinner) {
    html += '<span class="bracket-clear" onclick="event.stopPropagation(); clearPick(\'' + region + '\', ' + round + ', ' + index + ')">x</span>';
  }

  html += '</div>';
  return html;
}

// ============================================================
// Final Four View
// ============================================================

function getRegionWinner(region) {
  const picks = bracketPicks[region] || {};
  // Region winner is stored at round 3 (E8), index 0 — that's the last regional matchup winner
  // Actually round 4 index 0 is the F4 winner (getAdvancedTeam(region, 4, 0))
  return picks[3] ? picks[3][0] || null : null;
}

function renderFinalFour() {
  const container = document.getElementById('bracket-content');
  if (!container) return;

  const ff = bracketPicks.final_four || {};
  const semi1Picks = ff[0] || {};
  const champPicks = ff[1] || {};

  // Get region winners
  const eastWinner = getRegionWinner('east');
  const westWinner = getRegionWinner('west');
  const southWinner = getRegionWinner('south');
  const midwestWinner = getRegionWinner('midwest');

  let html = '<div class="ff-container">';

  // Semifinals
  html += '<div class="ff-semis">';

  // Semi 1: East vs West
  html += '<div class="ff-semi">';
  html += '<div class="ff-semi-label">east vs west</div>';
  html += '<div class="bracket-matchup">';
  html += renderFFSlot('final_four', 0, 0, eastWinner, 'east', 'championship', semi1Picks[0]);
  html += '<div class="bracket-vs">vs</div>';
  html += renderFFSlot('final_four', 0, 0, westWinner, 'west', 'championship', semi1Picks[0]);
  html += '</div>';
  html += '</div>';

  // Semi 2: South vs Midwest
  html += '<div class="ff-semi">';
  html += '<div class="ff-semi-label">south vs midwest</div>';
  html += '<div class="bracket-matchup">';
  html += renderFFSlot('final_four', 0, 1, southWinner, 'south', 'championship', semi1Picks[1]);
  html += '<div class="bracket-vs">vs</div>';
  html += renderFFSlot('final_four', 0, 1, midwestWinner, 'midwest', 'championship', semi1Picks[1]);
  html += '</div>';
  html += '</div>';

  html += '</div>';

  // Connector
  html += '<div class="ff-connector">|</div>';

  // Championship
  const semi1Winner = semi1Picks[0] || null;
  const semi2Winner = semi1Picks[1] || null;

  html += '<div class="ff-championship">';
  html += '<div class="ff-semi-label">championship</div>';
  html += '<div class="bracket-matchup">';
  html += renderFFChampSlot(semi1Winner, 'win_title', champPicks[0]);
  html += '<div class="bracket-vs">vs</div>';
  html += renderFFChampSlot(semi2Winner, 'win_title', champPicks[0]);
  html += '</div>';
  html += '</div>';

  // Connector
  html += '<div class="ff-connector">|</div>';

  // Champion
  html += '<div class="ff-champion">';
  html += '<div class="ff-champion-label">champion</div>';
  html += '<div class="bracket-matchup bracket-winner-slot">';
  const champion = champPicks[0] || null;
  if (champion) {
    const prob = getTeamFair(champion, 'win_title');
    const seed = getTeamSeed(champion);
    const champCtx = '{&quot;region&quot;:&quot;final_four&quot;,&quot;round&quot;:1,&quot;index&quot;:0,&quot;team&quot;:&quot;' + esc(champion).replace(/"/g, '&quot;') + '&quot;,&quot;roundKey&quot;:&quot;win_title&quot;,&quot;isAdvanced&quot;:true,&quot;isFF&quot;:true}';
    html += '<div class="bracket-team bracket-advanced" onclick="openBracketBet(\'' + esc(champion) + '\', \'win_title\')" oncontextmenu="showBracketContextMenu(event, ' + champCtx + ')">';
    html += '<span class="bracket-seed">' + seed + '</span> ';
    html += '<span class="bracket-team-name">' + champion + '</span>';
    html += fairOddsHtml(prob);
    html += '<span class="bracket-clear" onclick="event.stopPropagation(); clearFFPick(1, 0)">x</span>';
    html += '</div>';
  } else {
    html += '<div class="bracket-team bracket-empty">tbd</div>';
  }
  html += '</div>';
  html += '</div>';

  html += '</div>';
  container.innerHTML = html;
}

function renderFFSlot(ffRegion, round, matchupIndex, team, sourceRegion, fairRound, winner) {
  if (!team) {
    return '<div class="bracket-team bracket-empty">tbd (' + sourceRegion + ')</div>';
  }

  const isWinner = winner === team;
  const isLoser = winner && !isWinner;
  const prob = getTeamFair(team, fairRound);
  const seed = getTeamSeed(team);

  let cls = 'bracket-team';
  if (isWinner) cls += ' bracket-advanced';
  if (isLoser) cls += ' bracket-eliminated';

  const ctxData = '{&quot;region&quot;:&quot;final_four&quot;,&quot;round&quot;:0,&quot;index&quot;:' + matchupIndex + ',&quot;team&quot;:&quot;' + esc(team).replace(/"/g, '&quot;') + '&quot;,&quot;roundKey&quot;:&quot;' + fairRound + '&quot;,&quot;isAdvanced&quot;:' + isWinner + ',&quot;isFF&quot;:true}';

  let html = '<div class="' + cls + '" onclick="advanceFF(0, ' + matchupIndex + ', \'' + esc(team) + '\')" oncontextmenu="showBracketContextMenu(event, ' + ctxData + ')">';
  html += '<span class="bracket-seed">' + seed + '</span> ';
  html += '<span class="bracket-team-name">' + team + '</span>';
  html += fairOddsHtml(prob);

  if (isWinner) {
    html += '<span class="bracket-clear" onclick="event.stopPropagation(); clearFFPick(0, ' + matchupIndex + ')">x</span>';
  }

  html += '</div>';
  return html;
}

function renderFFChampSlot(team, fairRound, winner) {
  if (!team) {
    return '<div class="bracket-team bracket-empty">tbd</div>';
  }

  const isWinner = winner === team;
  const isLoser = winner && !isWinner;
  const prob = getTeamFair(team, fairRound);
  const seed = getTeamSeed(team);

  let cls = 'bracket-team';
  if (isWinner) cls += ' bracket-advanced';
  if (isLoser) cls += ' bracket-eliminated';

  const ctxData = '{&quot;region&quot;:&quot;final_four&quot;,&quot;round&quot;:1,&quot;index&quot;:0,&quot;team&quot;:&quot;' + esc(team).replace(/"/g, '&quot;') + '&quot;,&quot;roundKey&quot;:&quot;win_title&quot;,&quot;isAdvanced&quot;:' + isWinner + ',&quot;isFF&quot;:true}';

  let html = '<div class="' + cls + '" onclick="advanceFF(1, 0, \'' + esc(team) + '\')" oncontextmenu="showBracketContextMenu(event, ' + ctxData + ')">';
  html += '<span class="bracket-seed">' + seed + '</span> ';
  html += '<span class="bracket-team-name">' + team + '</span>';
  html += fairOddsHtml(prob);

  if (isWinner) {
    html += '<span class="bracket-clear" onclick="event.stopPropagation(); clearFFPick(1, 0)">x</span>';
  }

  html += '</div>';
  return html;
}

function advanceFF(round, matchupIndex, team) {
  if (isRoundLocked('final_four', 0)) return;

  if (!bracketPicks.final_four) bracketPicks.final_four = {};
  if (!bracketPicks.final_four[round]) bracketPicks.final_four[round] = {};

  if (bracketPicks.final_four[round][matchupIndex] === team) return;

  bracketPicks.final_four[round][matchupIndex] = team;

  // Clear downstream
  if (round === 0) {
    // Clearing championship pick if semi winner changed
    if (bracketPicks.final_four[1]) {
      delete bracketPicks.final_four[1][0];
    }
  }

  saveBracketPicks();
  renderFinalFour();
}

function clearFFPick(round, matchupIndex) {
  if (isRoundLocked('final_four', 0)) return;
  if (!bracketPicks.final_four || !bracketPicks.final_four[round]) return;

  delete bracketPicks.final_four[round][matchupIndex];

  // Clear downstream
  if (round === 0 && bracketPicks.final_four[1]) {
    delete bracketPicks.final_four[1][0];
  }

  saveBracketPicks();
  renderFinalFour();
}

// ============================================================
// Advance / Clear logic (regions)
// ============================================================

function advanceTeam(region, round, matchupIndex, team) {
  if (isRoundLocked(region, round)) return;

  if (!bracketPicks[region]) bracketPicks[region] = {};
  if (!bracketPicks[region][round]) bracketPicks[region][round] = {};

  if (bracketPicks[region][round][matchupIndex] === team) return;

  bracketPicks[region][round][matchupIndex] = team;
  clearDownstream(region, round + 1, Math.floor(matchupIndex / 2));

  saveBracketPicks();
  renderBracketRegion(region);
}

function clearPick(region, round, matchupIndex) {
  if (isRoundLocked(region, round)) return;
  if (!bracketPicks[region] || !bracketPicks[region][round]) return;

  delete bracketPicks[region][round][matchupIndex];
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
  const prevRound = round - 1;
  if (prevRound < 0) return null;
  if (!picks[prevRound]) return null;
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
