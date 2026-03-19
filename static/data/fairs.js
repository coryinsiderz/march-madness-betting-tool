const NCAA_FAIRS = [
  { team: "Duke", region: "East", seed: 1, play_in: 1.00000, r32: 0.97895, s16: 0.80670, e8: 0.61275, f4: 0.44135, championship: 0.26235, win_title: 0.15220 },
  { team: "Michigan", region: "Midwest", seed: 1, play_in: 1.00000, r32: 0.97635, s16: 0.82620, e8: 0.63960, f4: 0.41880, championship: 0.25335, win_title: 0.14885 },
  { team: "Arizona", region: "South", seed: 1, play_in: 1.00000, r32: 0.98230, s16: 0.81490, e8: 0.59855, f4: 0.37190, championship: 0.22190, win_title: 0.12265 },
  { team: "Purdue", region: "South", seed: 2, play_in: 1.00000, r32: 0.97150, s16: 0.73945, e8: 0.49125, f4: 0.27665, championship: 0.16735, win_title: 0.09420 },
  { team: "Florida", region: "West", seed: 1, play_in: 1.00000, r32: 0.98975, s16: 0.81940, e8: 0.54960, f4: 0.30390, championship: 0.16565, win_title: 0.08820 },
  { team: "Iowa St.", region: "Midwest", seed: 2, play_in: 1.00000, r32: 0.96805, s16: 0.73010, e8: 0.47315, f4: 0.25185, championship: 0.13775, win_title: 0.07200 },
  { team: "Houston", region: "West", seed: 2, play_in: 1.00000, r32: 0.95440, s16: 0.73190, e8: 0.47255, f4: 0.28185, championship: 0.14230, win_title: 0.07135 },
  { team: "Illinois", region: "West", seed: 3, play_in: 1.00000, r32: 0.95880, s16: 0.75705, e8: 0.38560, f4: 0.20170, championship: 0.09800, win_title: 0.04695 },
  { team: "Connecticut", region: "East", seed: 2, play_in: 1.00000, r32: 0.94675, s16: 0.64865, e8: 0.37070, f4: 0.15925, championship: 0.07325, win_title: 0.03130 },
  { team: "Gonzaga", region: "South", seed: 3, play_in: 1.00000, r32: 0.94125, s16: 0.59665, e8: 0.27725, f4: 0.12145, championship: 0.05270, win_title: 0.02175 },
  { team: "Vanderbilt", region: "West", seed: 5, play_in: 1.00000, r32: 0.83905, s16: 0.53740, e8: 0.23740, f4: 0.10770, championship: 0.04865, win_title: 0.02120 },
  { team: "Michigan St.", region: "East", seed: 3, play_in: 1.00000, r32: 0.90910, s16: 0.56175, e8: 0.30410, f4: 0.12385, championship: 0.05000, win_title: 0.02005 },
  { team: "St. John's", region: "East", seed: 5, play_in: 1.00000, r32: 0.83185, s16: 0.52560, e8: 0.18805, f4: 0.09740, championship: 0.03885, win_title: 0.01460 },
  { team: "Tennessee", region: "Midwest", seed: 6, play_in: 1.00000, r32: 0.77000, s16: 0.44225, e8: 0.19735, f4: 0.08060, championship: 0.03480, win_title: 0.01360 },
  { team: "Alabama", region: "Midwest", seed: 4, play_in: 1.00000, r32: 0.81175, s16: 0.53075, e8: 0.18445, f4: 0.08285, championship: 0.03325, win_title: 0.01265 },
  { team: "Virginia", region: "Midwest", seed: 3, play_in: 1.00000, r32: 0.91315, s16: 0.47020, e8: 0.19970, f4: 0.07385, championship: 0.02940, win_title: 0.01115 },
  { team: "Arkansas", region: "South", seed: 4, play_in: 1.00000, r32: 0.87610, s16: 0.50115, e8: 0.17825, f4: 0.07900, championship: 0.03130, win_title: 0.01085 },
  { team: "Wisconsin", region: "South", seed: 5, play_in: 1.00000, r32: 0.79650, s16: 0.42940, e8: 0.14010, f4: 0.05440, championship: 0.02065, win_title: 0.00700 },
  { team: "Kansas", region: "East", seed: 4, play_in: 1.00000, r32: 0.84650, s16: 0.39730, e8: 0.10575, f4: 0.04565, championship: 0.01435, win_title: 0.00450 },
  { team: "Nebraska", region: "West", seed: 4, play_in: 1.00000, r32: 0.89040, s16: 0.40310, e8: 0.12960, f4: 0.04270, championship: 0.01350, win_title: 0.00425 },
  { team: "Louisville", region: "East", seed: 6, play_in: 1.00000, r32: 0.61060, s16: 0.28345, e8: 0.12925, f4: 0.04170, championship: 0.01430, win_title: 0.00420 },
  { team: "BYU", region: "South", seed: 6, play_in: 1.00000, r32: 0.59795, s16: 0.26395, e8: 0.09390, f4: 0.03390, championship: 0.01260, win_title: 0.00400 },
  { team: "Texas Tech", region: "Midwest", seed: 5, play_in: 1.00000, r32: 0.70745, s16: 0.33345, e8: 0.08480, f4: 0.03075, championship: 0.00980, win_title: 0.00290 },
  { team: "UCLA", region: "East", seed: 7, play_in: 1.00000, r32: 0.65600, s16: 0.26030, e8: 0.11825, f4: 0.03650, championship: 0.01025, win_title: 0.00290 },
  { team: "Kentucky", region: "Midwest", seed: 7, play_in: 1.00000, r32: 0.60170, s16: 0.18360, e8: 0.08185, f4: 0.02505, championship: 0.00820, win_title: 0.00250 },
  { team: "Ohio St.", region: "East", seed: 8, play_in: 1.00000, r32: 0.55440, s16: 0.11935, e8: 0.05735, f4: 0.02435, championship: 0.00735, win_title: 0.00225 },
  { team: "Miami FL", region: "South", seed: 7, play_in: 1.00000, r32: 0.50235, s16: 0.12865, e8: 0.05320, f4: 0.01605, championship: 0.00490, win_title: 0.00150 },
  { team: "Iowa", region: "West", seed: 9, play_in: 1.00000, r32: 0.54035, s16: 0.10820, e8: 0.04805, f4: 0.01465, championship: 0.00435, win_title: 0.00125 },
  { team: "Georgia", region: "Midwest", seed: 8, play_in: 1.00000, r32: 0.57600, s16: 0.11275, e8: 0.05230, f4: 0.01690, championship: 0.00520, win_title: 0.00125 },
  { team: "Saint Mary's", region: "West", seed: 7, play_in: 1.00000, r32: 0.57355, s16: 0.16540, e8: 0.05865, f4: 0.01805, championship: 0.00495, win_title: 0.00115 },
  { team: "Utah St.", region: "South", seed: 9, play_in: 1.00000, r32: 0.53165, s16: 0.10545, e8: 0.04530, f4: 0.01390, championship: 0.00400, win_title: 0.00100 },
  { team: "Clemson", region: "West", seed: 8, play_in: 1.00000, r32: 0.45965, s16: 0.07225, e8: 0.02825, f4: 0.00770, championship: 0.00185, win_title: 0.00050 },
  { team: "Villanova", region: "South", seed: 8, play_in: 1.00000, r32: 0.46835, s16: 0.07815, e8: 0.03100, f4: 0.00900, championship: 0.00225, win_title: 0.00050 },
  { team: "South Florida", region: "East", seed: 11, play_in: 1.00000, r32: 0.38940, s16: 0.13865, e8: 0.05180, f4: 0.01345, championship: 0.00325, win_title: 0.00050 },
  { team: "Missouri", region: "South", seed: 10, play_in: 1.00000, r32: 0.49765, s16: 0.12950, e8: 0.04405, f4: 0.01115, championship: 0.00260, win_title: 0.00050 },
  { team: "North Carolina", region: "West", seed: 6, play_in: 1.00000, r32: 0.56560, s16: 0.14945, e8: 0.03825, f4: 0.01065, championship: 0.00250, win_title: 0.00050 },
  { team: "N.C. State", region: "South", seed: 11, play_in: 0.50774, r32: 0.21055, s16: 0.07195, e8: 0.02140, f4: 0.00640, championship: 0.00175, win_title: 0.00040 },
  { team: "Texas A&M", region: "West", seed: 10, play_in: 1.00000, r32: 0.42645, s16: 0.09510, e8: 0.02760, f4: 0.00690, championship: 0.00135, win_title: 0.00035 },
  { team: "Saint Louis", region: "Midwest", seed: 9, play_in: 1.00000, r32: 0.42400, s16: 0.05815, e8: 0.02260, f4: 0.00630, championship: 0.00145, win_title: 0.00035 },
  { team: "Texas", region: "South", seed: 11, play_in: 0.49227, r32: 0.19175, s16: 0.06035, e8: 0.01820, f4: 0.00450, championship: 0.00120, win_title: 0.00035 },
  { team: "Santa Clara", region: "Midwest", seed: 10, play_in: 1.00000, r32: 0.39830, s16: 0.08255, e8: 0.02800, f4: 0.00680, championship: 0.00135, win_title: 0.00025 },
  { team: "TCU", region: "East", seed: 9, play_in: 1.00000, r32: 0.44560, s16: 0.07170, e8: 0.02840, f4: 0.01000, championship: 0.00215, win_title: 0.00025 },
  { team: "UCF", region: "East", seed: 10, play_in: 1.00000, r32: 0.34400, s16: 0.08335, e8: 0.02320, f4: 0.00420, championship: 0.00075, win_title: 0.00000 },
  { team: "VCU", region: "West", seed: 11, play_in: 1.00000, r32: 0.43440, s16: 0.08665, e8: 0.01645, f4: 0.00370, championship: 0.00050, win_title: 0.00000 },
  { team: "SMU", region: "Midwest", seed: 11, play_in: 0.73454, r32: 0.20345, s16: 0.07350, e8: 0.01875, f4: 0.00420, championship: 0.00075, win_title: 0.00000 },
  { team: "Miami OH", region: "Midwest", seed: 11, play_in: 0.26546, r32: 0.02630, s16: 0.00460, e8: 0.00025, f4: 0.00000, championship: 0.00000, win_title: 0.00000 },
  { team: "Akron", region: "Midwest", seed: 12, play_in: 1.00000, r32: 0.29255, s16: 0.07695, e8: 0.00950, f4: 0.00135, championship: 0.00000, win_title: 0.00000 },
  { team: "High Point", region: "South", seed: 12, play_in: 1.00000, r32: 0.20350, s16: 0.04665, e8: 0.00505, f4: 0.00075, championship: 0.00000, win_title: 0.00000 },
  { team: "McNeese", region: "West", seed: 12, play_in: 1.00000, r32: 0.16095, s16: 0.04895, e8: 0.00665, f4: 0.00075, championship: 0.00000, win_title: 0.00000 },
  { team: "Northern Iowa", region: "East", seed: 12, play_in: 1.00000, r32: 0.16815, s16: 0.05535, e8: 0.00645, f4: 0.00140, championship: 0.00000, win_title: 0.00000 },
  { team: "Hofstra", region: "Midwest", seed: 13, play_in: 1.00000, r32: 0.18825, s16: 0.05895, e8: 0.00660, f4: 0.00100, championship: 0.00000, win_title: 0.00000 },
  { team: "Cal Baptist", region: "East", seed: 13, play_in: 1.00000, r32: 0.15350, s16: 0.02225, e8: 0.00150, f4: 0.00000, championship: 0.00000, win_title: 0.00000 },
  { team: "Hawaii", region: "South", seed: 13, play_in: 1.00000, r32: 0.12390, s16: 0.02320, e8: 0.00175, f4: 0.00000, championship: 0.00000, win_title: 0.00000 },
  { team: "Troy", region: "West", seed: 13, play_in: 1.00000, r32: 0.10960, s16: 0.01080, e8: 0.00060, f4: 0.00000, championship: 0.00000, win_title: 0.00000 },
  { team: "North Dakota St.", region: "East", seed: 14, play_in: 1.00000, r32: 0.09090, s16: 0.01580, e8: 0.00245, f4: 0.00000, championship: 0.00000, win_title: 0.00000 },
  { team: "Wright St.", region: "Midwest", seed: 14, play_in: 1.00000, r32: 0.08685, s16: 0.00895, e8: 0.00050, f4: 0.00000, championship: 0.00000, win_title: 0.00000 },
  { team: "Kennesaw St.", region: "South", seed: 14, play_in: 1.00000, r32: 0.05875, s16: 0.00670, e8: 0.00010, f4: 0.00000, championship: 0.00000, win_title: 0.00000 },
  { team: "Penn", region: "West", seed: 14, play_in: 1.00000, r32: 0.04120, s16: 0.00735, e8: 0.00025, f4: 0.00000, championship: 0.00000, win_title: 0.00000 },
  { team: "Furman", region: "East", seed: 15, play_in: 1.00000, r32: 0.05325, s16: 0.00730, e8: 0.00060, f4: 0.00000, championship: 0.00000, win_title: 0.00000 },
  { team: "Idaho", region: "West", seed: 15, play_in: 1.00000, r32: 0.04560, s16: 0.00745, e8: 0.00085, f4: 0.00000, championship: 0.00000, win_title: 0.00000 },
  { team: "Queens", region: "South", seed: 15, play_in: 1.00000, r32: 0.02850, s16: 0.00250, e8: 0.00000, f4: 0.00000, championship: 0.00000, win_title: 0.00000 },
  { team: "Tennessee St.", region: "Midwest", seed: 15, play_in: 1.00000, r32: 0.03195, s16: 0.00390, e8: 0.00025, f4: 0.00000, championship: 0.00000, win_title: 0.00000 },
  { team: "Siena", region: "East", seed: 16, play_in: 1.00000, r32: 0.02105, s16: 0.00210, e8: 0.00000, f4: 0.00000, championship: 0.00000, win_title: 0.00000 },
  { team: "LIU", region: "South", seed: 16, play_in: 1.00000, r32: 0.01770, s16: 0.00135, e8: 0.00000, f4: 0.00000, championship: 0.00000, win_title: 0.00000 },
  { team: "UMBC", region: "Midwest", seed: 16, play_in: 0.53730, r32: 0.01480, s16: 0.00250, e8: 0.00025, f4: 0.00000, championship: 0.00000, win_title: 0.00000 },
  { team: "Howard", region: "Midwest", seed: 16, play_in: 0.46271, r32: 0.00885, s16: 0.00100, e8: 0.00000, f4: 0.00000, championship: 0.00000, win_title: 0.00000 },
  { team: "Prairie View A&M", region: "West", seed: 16, play_in: 0.50696, r32: 0.00515, s16: 0.00000, e8: 0.00000, f4: 0.00000, championship: 0.00000, win_title: 0.00000 },
  { team: "Lehigh", region: "West", seed: 16, play_in: 0.49305, r32: 0.00510, s16: 0.00000, e8: 0.00000, f4: 0.00000, championship: 0.00000, win_title: 0.00000 }
];

// helper functions

function getTeamFair(teamName, round) {
  const team = NCAA_FAIRS.find(t => t.team.toLowerCase() === teamName.toLowerCase());
  if (!team) return null;
  return team[round] || null;
}

function getFairDecimalOdds(teamName, round) {
  const prob = getTeamFair(teamName, round);
  if (!prob || prob <= 0) return null;
  return 1 / prob;
}

function getFairAmericanOdds(teamName, round) {
  const prob = getTeamFair(teamName, round);
  if (!prob || prob <= 0) return null;
  if (prob >= 1) return null;
  if (prob >= 0.5) return Math.round(-100 * prob / (1 - prob));
  return Math.round(100 * (1 - prob) / prob);
}

function getAllTeams() {
  return NCAA_FAIRS.map(t => t.team).sort();
}

function getTeamsByRegion(region) {
  return NCAA_FAIRS.filter(t => t.region === region).sort((a, b) => a.seed - b.seed);
}

function getRoundOptions() {
  return [
    { key: 'r32', label: 'round of 32' },
    { key: 's16', label: 'sweet 16' },
    { key: 'e8', label: 'elite 8' },
    { key: 'f4', label: 'final four' },
    { key: 'championship', label: 'championship' },
    { key: 'win_title', label: 'win title' }
  ];
}
