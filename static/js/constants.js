// constants.js - NCAA betting tool constants

const KELLY_FRACTION = 0.25;

// Kalshi parabolic fee: fee = price * (1-price) * maxFee / 0.25
// where maxFee is the fee at 50 cents
const KALSHI_TAKER_MAX = 1.75;  // 1.75 cents max at 50%
const KALSHI_MAKER_MAX = 0.44;  // 0.44 cents max at 50%

function kalshiFee(priceInCents, isTaker) {
  const p = priceInCents / 100;
  const maxFee = isTaker ? KALSHI_TAKER_MAX : KALSHI_MAKER_MAX;
  return p * (1 - p) * maxFee / 0.25;
}

// Polymarket fee = 0 (no fees)
const POLY_FEE = 0;

// Book abbreviation maps
const BOOK_ABBR_MAP = {
  'draftkings': 'dk', 'fanduel': 'fd', 'betonline': 'bol',
  'bovada': 'bov', 'bookmaker': 'bm', 'bet365': '365',
  'kalshi': 'kalshi', 'polymarket': 'poly',
  'cloudbet': 'cb', 'bet105': '105',
  'betmgm': 'mgm', 'caesars': 'czr', 'pinnacle': 'pinny'
};

const BOOK_DISPLAY_MAP = {
  'dk': 'DraftKings', 'fd': 'FanDuel', 'bol': 'BetOnline',
  'bov': 'Bovada', 'bm': 'Bookmaker', '365': 'bet365',
  'kalshi': 'Kalshi', 'poly': 'Polymarket',
  'cb': 'Cloudbet', '105': 'Bet105',
  'mgm': 'BetMGM', 'czr': 'Caesars', 'pinny': 'Pinnacle'
};

// Books available in log-bet dropdown
const AVAILABLE_BOOKS = [
  { value: 'dk', label: 'DraftKings' },
  { value: 'fd', label: 'FanDuel' },
  { value: 'bov', label: 'Bovada' },
  { value: 'bol', label: 'BetOnline' },
  { value: 'bm', label: 'Bookmaker' },
  { value: '365', label: 'bet365' },
  { value: 'kalshi', label: 'Kalshi' },
  { value: 'poly', label: 'Polymarket' },
  { value: 'cb', label: 'Cloudbet' },
  { value: '105', label: 'Bet105' }
];

// PM books (prediction markets)
const PM_BOOKS = ['kalshi', 'poly'];

function isPmBook(bookAbbr) {
  return PM_BOOKS.includes(bookAbbr);
}

// NCAA market types
const NCAA_MARKET_TYPES = {
  'win_title': 'win title',
  'reach_championship': 'reach championship',
  'reach_f4': 'reach final four',
  'reach_e8': 'reach elite 8',
  'reach_s16': 'reach sweet 16',
  'reach_r32': 'reach round of 32',
  'game_ml': 'game moneyline',
  'game_spread': 'game spread',
  'game_total': 'game total',
  'other': 'other'
};

// Map from fairs round key to market type
const ROUND_TO_MARKET_TYPE = {
  'win_title': 'win_title',
  'championship': 'reach_championship',
  'f4': 'reach_f4',
  'e8': 'reach_e8',
  's16': 'reach_s16',
  'r32': 'reach_r32'
};

// Market type categories for tracking tab grouping
const MARKET_CATEGORIES = {
  'outrights': ['win_title'],
  'reach championship': ['reach_championship'],
  'final four': ['reach_f4'],
  'elite 8': ['reach_e8'],
  'sweet 16': ['reach_s16'],
  'round of 32': ['reach_r32'],
  'game lines': ['game_ml', 'game_spread', 'game_total'],
  'other': ['other']
};

// Order for displaying market categories
const CATEGORY_ORDER = [
  'outrights', 'reach championship', 'final four', 'elite 8',
  'sweet 16', 'round of 32', 'game lines', 'other'
];
