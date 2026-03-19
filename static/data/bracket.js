const NCAA_BRACKET = {
  regions: {
    east: {
      name: "East",
      matchups: [
        { seed1: 1, seed2: 16, team1: "Duke", team2: "Siena" },
        { seed1: 8, seed2: 9, team1: "Ohio St.", team2: "TCU" },
        { seed1: 5, seed2: 12, team1: "St. John's", team2: "Northern Iowa" },
        { seed1: 4, seed2: 13, team1: "Kansas", team2: "Cal Baptist" },
        { seed1: 6, seed2: 11, team1: "Louisville", team2: "South Florida" },
        { seed1: 3, seed2: 14, team1: "Michigan St.", team2: "North Dakota St." },
        { seed1: 7, seed2: 10, team1: "UCLA", team2: "UCF" },
        { seed1: 2, seed2: 15, team1: "Connecticut", team2: "Furman" }
      ]
    },
    west: {
      name: "West",
      matchups: [
        { seed1: 1, seed2: 16, team1: "Arizona", team2: "LIU" },
        { seed1: 8, seed2: 9, team1: "Villanova", team2: "Utah St." },
        { seed1: 5, seed2: 12, team1: "Wisconsin", team2: "High Point" },
        { seed1: 4, seed2: 13, team1: "Arkansas", team2: "Hawaii" },
        { seed1: 6, seed2: 11, team1: "BYU", team2: "N.C. State" },
        { seed1: 3, seed2: 14, team1: "Gonzaga", team2: "Kennesaw St." },
        { seed1: 7, seed2: 10, team1: "Miami FL", team2: "Missouri" },
        { seed1: 2, seed2: 15, team1: "Purdue", team2: "Queens" }
      ]
    },
    south: {
      name: "South",
      matchups: [
        { seed1: 1, seed2: 16, team1: "Florida", team2: "Prairie View A&M" },
        { seed1: 8, seed2: 9, team1: "Clemson", team2: "Iowa" },
        { seed1: 5, seed2: 12, team1: "Vanderbilt", team2: "McNeese" },
        { seed1: 4, seed2: 13, team1: "Nebraska", team2: "Troy" },
        { seed1: 6, seed2: 11, team1: "North Carolina", team2: "VCU" },
        { seed1: 3, seed2: 14, team1: "Illinois", team2: "Penn" },
        { seed1: 7, seed2: 10, team1: "Saint Mary's", team2: "Texas A&M" },
        { seed1: 2, seed2: 15, team1: "Houston", team2: "Idaho" }
      ]
    },
    midwest: {
      name: "Midwest",
      matchups: [
        { seed1: 1, seed2: 16, team1: "Michigan", team2: "Howard" },
        { seed1: 8, seed2: 9, team1: "Georgia", team2: "Saint Louis" },
        { seed1: 5, seed2: 12, team1: "Texas Tech", team2: "Akron" },
        { seed1: 4, seed2: 13, team1: "Alabama", team2: "Hofstra" },
        { seed1: 6, seed2: 11, team1: "Tennessee", team2: "SMU" },
        { seed1: 3, seed2: 14, team1: "Virginia", team2: "Wright St." },
        { seed1: 7, seed2: 10, team1: "Kentucky", team2: "Santa Clara" },
        { seed1: 2, seed2: 15, team1: "Iowa St.", team2: "Tennessee St." }
      ]
    }
  },
  final_four: {
    semi1: { region1: "east", region2: "west" },
    semi2: { region1: "south", region2: "midwest" }
  }
};

function getFirstRoundMatchups(region) {
  const r = NCAA_BRACKET.regions[region.toLowerCase()];
  return r ? r.matchups : [];
}
