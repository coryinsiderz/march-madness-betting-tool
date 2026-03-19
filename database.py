"""
Postgres database for tracking NCAA March Madness bets.
All tables prefixed with ncaa_ to share Neon instance with golf-betting-tool.
"""

import os
from datetime import datetime
import psycopg2
import psycopg2.errors
from db import get_connection

# Book name to abbreviation mapping
BOOK_ABBR_MAP = {
    'draftkings': 'dk',
    'fanduel': 'fd',
    'betmgm': 'mgm',
    'caesars': 'czr',
    'pinnacle': 'pinny',
    'bet365': '365',
    'bovada': 'bov',
    'betonline': 'bol',
    'betrivers': 'br',
    'pointsbet': 'pb',
    'unibet': 'uni',
    'wynnbet': 'wynn',
    'bookmaker': 'bm',
    'betcris': 'bm',
    'cris': 'bm',
    'bet105': '105',
    'cloudbet': 'cb',
    'betway': 'way',
    'skybet': 'sky',
    'williamhill': 'wh',
    # Prediction Markets
    'kalshi': 'kalshi',
    'polymarket': 'poly',
}

# Reverse lookup: abbreviation to display name
BOOK_DISPLAY_MAP = {
    'dk': 'DraftKings',
    'fd': 'FanDuel',
    'mgm': 'BetMGM',
    'czr': 'Caesars',
    'pinny': 'Pinnacle',
    '365': 'bet365',
    'bov': 'Bovada',
    'bol': 'BetOnline',
    'br': 'BetRivers',
    'pb': 'PointsBet',
    'uni': 'Unibet',
    'wynn': 'WynnBET',
    'bm': 'Bookmaker',
    '105': 'Bet105',
    'cb': 'Cloudbet',
    'way': 'Betway',
    'sky': 'SkyBet',
    'wh': 'William Hill',
    'kalshi': 'Kalshi',
    'poly': 'Polymarket',
}


def get_book_abbr(book_name):
    """Get book abbreviation from full name."""
    if not book_name:
        return ''
    lower_book = book_name.lower()
    return BOOK_ABBR_MAP.get(lower_book, book_name[:3])


def normalize_team_name(name):
    """
    Normalize team names for consistent matching.
    Strips whitespace and standardizes formatting.
    """
    if not name:
        return ""
    return name.strip()


# ============================================================
# Config Table Helpers
# ============================================================

def get_config(key):
    """Get a config value by key."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT value FROM ncaa_config WHERE key = %s', (key,))
    row = cursor.fetchone()
    conn.close()
    return row['value'] if row else None


def set_config(key, value):
    """Set a config value (upsert)."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO ncaa_config (key, value) VALUES (%s, %s)
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
    ''', (key, str(value)))
    conn.commit()
    conn.close()


def get_bankroll(username):
    """Get current bankroll as float for a specific user."""
    value = get_config(f'bankroll_{username}')
    return float(value) if value else 40000.0


def update_bankroll(amount, username):
    """
    Add amount to bankroll (can be negative for losses).

    Args:
        amount: Amount to add (positive) or subtract (negative)
        username: The username whose bankroll to update

    Returns:
        New bankroll value
    """
    current = get_bankroll(username)
    new_value = current + amount
    set_config(f'bankroll_{username}', new_value)
    return new_value


# ============================================================
# Tournament Name Standardization
# ============================================================

def standardize_tournament_name(tournament_name):
    """
    Standardize tournament name using case-insensitive matching
    against existing events and bets.

    Args:
        tournament_name: The tournament name to standardize

    Returns:
        Standardized tournament name
    """
    if not tournament_name or not tournament_name.strip():
        return tournament_name

    conn = get_connection()
    cursor = conn.cursor()

    # Get all unique tournament names from both bets and events tables
    cursor.execute('SELECT DISTINCT tournament_name FROM ncaa_bets')
    existing_tournaments = [row['tournament_name'] for row in cursor.fetchall()]
    cursor.execute('SELECT DISTINCT event_name FROM ncaa_events')
    existing_events = [row['event_name'] for row in cursor.fetchall()]

    # Merge, preferring event names (canonical source), deduped case-insensitively
    seen_lower = set()
    combined = []
    for name in existing_events + existing_tournaments:
        if name and name.lower() not in seen_lower:
            seen_lower.add(name.lower())
            combined.append(name)
    existing_tournaments = combined

    if not existing_tournaments:
        conn.close()
        return tournament_name.strip().title()

    # Case-insensitive exact match
    input_lower = tournament_name.strip().lower()
    for existing in existing_tournaments:
        if existing.lower() == input_lower:
            conn.close()
            return existing

    # Substring match against unarchived event names
    cursor.execute('SELECT event_name FROM ncaa_events WHERE archived = 0')
    unarchived_events = [row['event_name'] for row in cursor.fetchall()]

    for event_name in unarchived_events:
        event_lower = event_name.lower()
        shorter = input_lower if len(input_lower) <= len(event_lower) else event_lower
        longer = event_lower if len(input_lower) <= len(event_lower) else input_lower

        if len(shorter) < 2:
            continue

        if shorter in longer:
            conn.close()
            if len(input_lower) > len(event_lower):
                # Input is more complete — rename event
                new_name = tournament_name.strip().title()
                cursor2 = conn.cursor()
                cursor2.execute('UPDATE ncaa_events SET event_name = %s WHERE event_name = %s', (new_name, event_name))
                conn.commit()
                return new_name
            else:
                return event_name

    conn.close()
    return tournament_name.strip().title()


# ============================================================
# Database Initialization
# ============================================================

def init_db():
    """Initialize Postgres database with ncaa_ prefixed tables."""
    conn = get_connection()
    cursor = conn.cursor()

    # NCAA bets table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS ncaa_bets (
            id SERIAL PRIMARY KEY,
            timestamp TEXT NOT NULL,
            tournament_name TEXT NOT NULL,
            market_type TEXT NOT NULL,
            player_name TEXT NOT NULL,
            bookie TEXT NOT NULL,
            fair_odds REAL NOT NULL,
            book_odds REAL NOT NULL,
            edge_percent REAL NOT NULL,
            predicted_kelly REAL NOT NULL,
            actual_stake REAL,
            bid_price REAL,
            filled_amount REAL,
            side TEXT,
            status TEXT DEFAULT 'Open',
            result TEXT,
            profit_loss REAL,
            sport_category TEXT DEFAULT 'NCAAB',
            graded_at TIMESTAMP,
            grading_bankroll_delta REAL DEFAULT NULL,
            notes TEXT,
            equivalent_shares REAL,
            price_per_share REAL,
            username TEXT
        )
    ''')

    # NCAA bet_logs table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS ncaa_bet_logs (
            id SERIAL PRIMARY KEY,
            bet_id INTEGER NOT NULL,
            timestamp TEXT NOT NULL,
            stake_added REAL NOT NULL,
            filled_added REAL,
            odds REAL NOT NULL,
            bid_price REAL,
            fair_odds REAL NOT NULL,
            edge_percent REAL NOT NULL,
            bookie TEXT,
            shares_bid REAL,
            shares_filled REAL,
            is_prediction_market INTEGER DEFAULT 0,
            is_finalized INTEGER DEFAULT 0,
            notes TEXT,
            username TEXT,
            FOREIGN KEY (bet_id) REFERENCES ncaa_bets (id)
        )
    ''')

    # NCAA events table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS ncaa_events (
            id SERIAL PRIMARY KEY,
            event_name TEXT NOT NULL UNIQUE,
            sport_category TEXT DEFAULT 'NCAAB',
            display_order INTEGER DEFAULT 0,
            archived INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # NCAA config table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS ncaa_config (
            key TEXT PRIMARY KEY,
            value TEXT
        )
    ''')

    # Track P/L of deleted graded bets so per-category totals stay in sync with bankroll
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS ncaa_deleted_bet_adjustments (
            id SERIAL PRIMARY KEY,
            category TEXT NOT NULL,
            amount REAL NOT NULL,
            description TEXT,
            username TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # Bracket picks table (one row per user, JSON blob)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS ncaa_bracket_picks (
            username TEXT PRIMARY KEY,
            picks_json TEXT NOT NULL DEFAULT '{}',
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    conn.commit()
    conn.close()
    print("NCAA database initialized")


# ============================================================
# Bracket Picks
# ============================================================

def save_bracket_picks(username, picks_json):
    """Save bracket picks for a user (upsert)."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO ncaa_bracket_picks (username, picks_json, updated_at)
        VALUES (%s, %s, CURRENT_TIMESTAMP)
        ON CONFLICT (username) DO UPDATE SET picks_json = %s, updated_at = CURRENT_TIMESTAMP
    ''', (username, picks_json, picks_json))
    conn.commit()
    conn.close()


def load_bracket_picks(username):
    """Load bracket picks for a user. Returns JSON string or '{}'."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT picks_json FROM ncaa_bracket_picks WHERE username = %s', (username,))
    row = cursor.fetchone()
    conn.close()
    if row:
        return row['picks_json']
    return '{}'


def get_all_bracket_picks():
    """Load all users' bracket picks. Returns list of {username, picks_json, updated_at}."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT username, picks_json, updated_at FROM ncaa_bracket_picks ORDER BY username')
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]


# ============================================================
# Event CRUD
# ============================================================

def _ensure_event_exists(tournament_name, sport_category='NCAAB'):
    """Auto-create event if none exists for this tournament name (case-insensitive check)."""
    if not tournament_name:
        return
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT id FROM ncaa_events WHERE LOWER(event_name) = LOWER(%s)', (tournament_name,))
    if not cursor.fetchone():
        create_event(tournament_name, sport_category)
        print(f"Auto-created event: '{tournament_name}' ({sport_category})")
    conn.close()


def create_event(event_name, sport_category='NCAAB'):
    """Create a new event. Normalizes name to title case and checks case-insensitively for duplicates."""
    event_name = event_name.strip().title() if event_name else event_name

    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute('SELECT id FROM ncaa_events WHERE LOWER(event_name) = LOWER(%s)', (event_name,))
        existing = cursor.fetchone()
        if existing:
            return existing['id']

        cursor.execute('''
            INSERT INTO ncaa_events (event_name, sport_category, display_order)
            VALUES (%s, %s, 0) RETURNING id
        ''', (event_name, sport_category))

        event_id = cursor.fetchone()['id']
        conn.commit()
        return event_id

    except psycopg2.errors.UniqueViolation:
        cursor.execute('SELECT id FROM ncaa_events WHERE event_name = %s', (event_name,))
        row = cursor.fetchone()
        return row['id'] if row else None

    finally:
        conn.close()


def get_events(sport_category=None, include_archived=True):
    """Get events, optionally filtered by sport category and archive status."""
    conn = get_connection()
    cursor = conn.cursor()

    if sport_category:
        if include_archived:
            cursor.execute('''
                SELECT id, event_name, sport_category, display_order, created_at, archived
                FROM ncaa_events
                WHERE sport_category = %s
                ORDER BY archived ASC, created_at DESC
            ''', (sport_category,))
        else:
            cursor.execute('''
                SELECT id, event_name, sport_category, display_order, created_at, archived
                FROM ncaa_events
                WHERE sport_category = %s AND (archived = 0 OR archived IS NULL)
                ORDER BY created_at DESC
            ''', (sport_category,))
    else:
        if include_archived:
            cursor.execute('''
                SELECT id, event_name, sport_category, display_order, created_at, archived
                FROM ncaa_events
                ORDER BY archived ASC, created_at DESC
            ''')
        else:
            cursor.execute('''
                SELECT id, event_name, sport_category, display_order, created_at, archived
                FROM ncaa_events
                WHERE archived = 0 OR archived IS NULL
                ORDER BY created_at DESC
            ''')

    events = []
    for row in cursor.fetchall():
        event = dict(row)
        event['archived'] = bool(event['archived']) if event['archived'] is not None else False
        events.append(event)

    conn.close()
    return events


def delete_event(event_id):
    """Delete an event (only if it has no bets)."""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute('SELECT event_name FROM ncaa_events WHERE id = %s', (event_id,))
    row = cursor.fetchone()

    if not row:
        conn.close()
        raise ValueError(f'Event {event_id} not found')

    event_name = row['event_name']

    cursor.execute('SELECT COUNT(*) FROM ncaa_bets WHERE tournament_name = %s', (event_name,))
    bet_count = cursor.fetchone()['count']

    if bet_count > 0:
        conn.close()
        raise ValueError(f'Cannot delete event "{event_name}" - it has {bet_count} bets')

    cursor.execute('DELETE FROM ncaa_events WHERE id = %s', (event_id,))
    conn.commit()
    conn.close()


def archive_event(event_id):
    """Archive an event."""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute('SELECT event_name FROM ncaa_events WHERE id = %s', (event_id,))
    row = cursor.fetchone()

    if not row:
        conn.close()
        raise ValueError(f'Event {event_id} not found')

    cursor.execute('UPDATE ncaa_events SET archived = 1 WHERE id = %s', (event_id,))
    conn.commit()
    conn.close()

    return row['event_name']


# ============================================================
# Bet CRUD
# ============================================================

def log_bet(bet_data):
    """
    Insert or update bet in database. Consolidates multiple bets on same team/tournament/market.

    For existing bets:
    - Updates total stake (adds new stake to existing)
    - Updates filled amount (adds new fill to existing)
    - Recalculates weighted average odds
    - Updates fair odds, edge, and timestamp

    Args:
        bet_data: Dict with keys:
            - tournament_name
            - market_type
            - player_name (stores team name for code compatibility)
            - bookie
            - fair_odds (decimal)
            - book_odds (decimal)
            - edge_percent
            - predicted_kelly
            - actual_stake
            - bid_price (optional, for limit orders)
            - filled_amount (optional, for partial fills)
            - username (required)

    Returns:
        Dict with bet_id and log_id, or None if bet was skipped
    """
    # Reject empty bets (0 stake and 0 filled) - defense in depth
    stake = bet_data.get('actual_stake', 0) or 0
    filled = bet_data.get('filled_amount', 0) or 0
    if stake == 0 and filled == 0:
        print(f"Skipping empty bet (0 stake, 0 filled): {bet_data.get('player_name')}")
        return None

    # Standardize tournament name
    bet_data['tournament_name'] = standardize_tournament_name(bet_data['tournament_name'])

    # Auto-create event if none exists
    sport_category = bet_data.get('sport_category', 'NCAAB')
    _ensure_event_exists(bet_data['tournament_name'], sport_category)

    # Normalize team name
    bet_data['player_name'] = normalize_team_name(bet_data['player_name'])

    conn = get_connection()
    cursor = conn.cursor()

    # Get side from bet_data (may be None for traditional books)
    bet_side = bet_data.get('side')

    # Check if bet already exists for this team/tournament/market/side/username
    cursor.execute('''
        SELECT * FROM ncaa_bets
        WHERE player_name = %s AND tournament_name = %s AND market_type = %s
        AND (side = %s OR (side IS NULL AND %s IS NULL)) AND status = 'Open'
        AND username = %s
        LIMIT 1
    ''', (bet_data['player_name'], bet_data['tournament_name'], bet_data['market_type'], bet_side, bet_side, bet_data['username']))

    existing_bet = cursor.fetchone()

    if existing_bet:
        # Update existing bet - consolidate stakes and recalculate weighted average odds
        old_stake = existing_bet['actual_stake'] or 0
        old_filled = existing_bet['filled_amount'] or 0
        old_odds = existing_bet['book_odds']

        new_stake = bet_data['actual_stake']
        new_filled = bet_data.get('filled_amount', 0)
        new_odds = bet_data['book_odds']

        # ONLY use filled amounts for weighting (not stakes)
        total_filled_weight = old_filled + new_filled

        if total_filled_weight > 0:
            weighted_avg_odds = (old_odds * old_filled + new_odds * new_filled) / total_filled_weight
        else:
            total_stake_weight = old_stake + new_stake
            weighted_avg_odds = (old_odds * old_stake + new_odds * new_stake) / total_stake_weight if total_stake_weight > 0 else new_odds

        # Calculate weighted average bid price (for prediction markets)
        old_bid_price = existing_bet['bid_price']
        new_bid_price = bet_data.get('bid_price')
        weighted_avg_bid_price = None

        if old_bid_price is not None and new_bid_price is not None:
            if total_filled_weight > 0:
                weighted_avg_bid_price = (old_bid_price * old_filled + new_bid_price * new_filled) / total_filled_weight
            else:
                total_stake_weight = old_stake + new_stake
                weighted_avg_bid_price = (old_bid_price * old_stake + new_bid_price * new_stake) / total_stake_weight if total_stake_weight > 0 else new_bid_price
        elif new_bid_price is not None:
            weighted_avg_bid_price = new_bid_price
        elif old_bid_price is not None:
            weighted_avg_bid_price = old_bid_price

        total_stake = old_stake + new_stake
        total_filled = old_filled + new_filled

        cursor.execute('''
            UPDATE ncaa_bets
            SET actual_stake = %s,
                filled_amount = %s,
                book_odds = %s,
                fair_odds = %s,
                edge_percent = %s,
                bid_price = %s,
                timestamp = %s
            WHERE id = %s
        ''', (
            total_stake,
            total_filled if total_filled > 0 else None,
            weighted_avg_odds,
            bet_data['fair_odds'],
            bet_data['edge_percent'],
            weighted_avg_bid_price,
            datetime.now().isoformat(),
            existing_bet['id']
        ))

        bet_id = existing_bet['id']

        # Log this addition to bet_logs
        bid_price = bet_data.get('bid_price')
        is_pm = bid_price is not None
        shares_bid = None
        shares_filled = None

        if is_pm and bid_price and bid_price > 0:
            shares_bid = new_stake / (bid_price / 100.0)
            if new_filled and new_filled > 0:
                shares_filled = new_filled / (bid_price / 100.0)

        cursor.execute('''
            INSERT INTO ncaa_bet_logs (
                bet_id, timestamp, stake_added, filled_added, odds, bid_price, fair_odds, edge_percent, bookie,
                shares_bid, shares_filled, is_prediction_market, username
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id
        ''', (
            bet_id,
            datetime.now().isoformat(),
            new_stake,
            new_filled if new_filled > 0 else None,
            new_odds,
            bid_price,
            bet_data['fair_odds'],
            bet_data['edge_percent'],
            bet_data['bookie'],
            shares_bid,
            shares_filled,
            1 if is_pm else 0,
            bet_data['username']
        ))
        log_id = cursor.fetchone()['id']

        conn.commit()
        conn.close()

        print(f"Updated bet #{bet_id}: {bet_data['player_name']} @ {bet_data['bookie']} (stake: ${old_stake} -> ${total_stake}, odds: {old_odds:.2f} -> {weighted_avg_odds:.2f})")
        return {'bet_id': bet_id, 'log_id': log_id}

    else:
        # Create new bet
        timestamp = datetime.now().isoformat()

        cursor.execute('''
            INSERT INTO ncaa_bets (
                timestamp, tournament_name, market_type, player_name, bookie,
                fair_odds, book_odds, edge_percent, predicted_kelly, actual_stake,
                bid_price, filled_amount, side, status, notes, username
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id
        ''', (
            timestamp,
            bet_data['tournament_name'],
            bet_data['market_type'],
            bet_data['player_name'],
            bet_data['bookie'],
            bet_data['fair_odds'],
            bet_data['book_odds'],
            bet_data['edge_percent'],
            bet_data['predicted_kelly'],
            bet_data['actual_stake'],
            bet_data.get('bid_price'),
            bet_data.get('filled_amount'),
            bet_side,
            'Open',
            bet_data.get('notes'),
            bet_data['username']
        ))

        bet_id = cursor.fetchone()['id']

        # Log initial bet to bet_logs
        bid_price = bet_data.get('bid_price')
        is_pm = bid_price is not None
        shares_bid = None
        shares_filled = None
        stake = bet_data['actual_stake']
        filled = bet_data.get('filled_amount')

        if is_pm and bid_price and bid_price > 0:
            shares_bid = stake / (bid_price / 100.0)
            if filled and filled > 0:
                shares_filled = filled / (bid_price / 100.0)

        cursor.execute('''
            INSERT INTO ncaa_bet_logs (
                bet_id, timestamp, stake_added, filled_added, odds, bid_price, fair_odds, edge_percent, bookie,
                shares_bid, shares_filled, is_prediction_market, username
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id
        ''', (
            bet_id,
            timestamp,
            stake,
            filled,
            bet_data['book_odds'],
            bid_price,
            bet_data['fair_odds'],
            bet_data['edge_percent'],
            bet_data['bookie'],
            shares_bid,
            shares_filled,
            1 if is_pm else 0,
            bet_data['username']
        ))
        log_id = cursor.fetchone()['id']

        conn.commit()
        conn.close()

        print(f"Logged new bet #{bet_id}: {bet_data['player_name']} @ {bet_data['bookie']}")
        return {'bet_id': bet_id, 'log_id': log_id}


def get_active_bets(username, group_by_tournament=True, include_closed=True):
    """
    Query bets from database for a specific user.
    Recalculates weighted average odds from bet_logs on-the-fly.

    Args:
        username: The username to filter bets by
        group_by_tournament: If True, return dict grouped by tournament.
                            If False, return flat list.
        include_closed: If True, include graded (Closed) bets. If False, only Open bets.

    Returns:
        If group_by_tournament=True: dict grouped by tournament
        If group_by_tournament=False: flat list
    """
    conn = get_connection()
    cursor = conn.cursor()

    if include_closed:
        cursor.execute('SELECT * FROM ncaa_bets WHERE username = %s ORDER BY timestamp DESC', (username,))
    else:
        cursor.execute("SELECT * FROM ncaa_bets WHERE username = %s AND status = 'Open' ORDER BY timestamp DESC", (username,))

    rows = cursor.fetchall()

    # Bulk fetch ALL bet_logs for this user in one query (avoids N+1 per-bet queries)
    cursor.execute('SELECT * FROM ncaa_bet_logs WHERE bet_id IN (SELECT id FROM ncaa_bets WHERE username = %s) ORDER BY bet_id, id', (username,))
    all_logs_raw = cursor.fetchall()
    all_logs_by_bet = {}
    for log in all_logs_raw:
        bid = log['bet_id']
        if bid not in all_logs_by_bet:
            all_logs_by_bet[bid] = []
        all_logs_by_bet[bid].append(log)

    # Convert Row objects to dicts and recalculate from bet_logs
    bets = []
    for row in rows:
        bet = dict(row)
        logs = all_logs_by_bet.get(bet['id'], [])

        if logs:
            total_weighted_odds = 0
            total_weight = 0
            total_shares_bid = 0
            total_shares_filled = 0
            has_pm_logs = False
            all_pm_logs_finalized = True

            effective_stake = 0
            original_cost = 0
            sale_proceeds = 0
            pending_amount = 0
            has_closes = False

            for log in logs:
                stake = log['stake_added'] if log['stake_added'] else 0
                odds = log['odds']
                filled = log['filled_added'] if log['filled_added'] else 0
                shares_bid = log['shares_bid'] if log['shares_bid'] else 0
                shares_filled = log['shares_filled'] if log['shares_filled'] else 0
                is_finalized = log['is_finalized'] if log['is_finalized'] else 0
                is_pm = log['is_prediction_market'] if log['is_prediction_market'] else 0

                # Track original cost vs sale proceeds
                if is_pm:
                    if filled > 0:
                        original_cost += filled
                    elif filled < 0:
                        sale_proceeds += abs(filled)
                else:
                    if filled > 0:
                        original_cost += filled

                if shares_filled < 0:
                    has_closes = True

                # Pending amount from unfinalized positive logs
                if is_pm and not is_finalized and stake > 0 and filled >= 0:
                    unfilled = stake - filled
                    if unfilled > 0:
                        pending_amount += unfilled

                # Calculate effective stake for this log
                if is_finalized:
                    effective_stake += filled
                else:
                    effective_stake += stake

                # Track PM log finalization status
                if is_pm:
                    has_pm_logs = True
                    if not is_finalized:
                        all_pm_logs_finalized = False

                # ONLY use filled amounts for weighted average
                if filled > 0:
                    total_weighted_odds += odds * filled
                    total_weight += filled

                total_shares_bid += shares_bid
                total_shares_filled += shares_filled

            if total_weight > 0:
                bet['book_odds'] = total_weighted_odds / total_weight
            else:
                total_bid_weighted_odds = 0
                total_bid_weight = 0
                for log in logs:
                    stake = log['stake_added']
                    odds = log['odds']
                    if stake > 0:
                        total_bid_weighted_odds += odds * stake
                        total_bid_weight += stake
                if total_bid_weight > 0:
                    bet['book_odds'] = total_bid_weighted_odds / total_bid_weight

            bet['total_shares_bid'] = total_shares_bid if total_shares_bid > 0 else None
            bet['total_shares_filled'] = total_shares_filled if total_shares_filled > 0 else None
            bet['all_logs_finalized'] = has_pm_logs and all_pm_logs_finalized
            bet['effective_stake'] = effective_stake
            bet['original_cost'] = original_cost
            bet['sale_proceeds'] = sale_proceeds
            bet['has_closes'] = has_closes
            bet['pending_amount'] = pending_amount

            adjusted_cost_basis = original_cost - sale_proceeds
            if adjusted_cost_basis <= 0:
                adjusted_cost_basis = 1
            bet['adjusted_cost_basis'] = adjusted_cost_basis
            bet['is_freeroll'] = adjusted_cost_basis <= 1

        # Get unique books from logs
        bookie_first_ts = {}
        for l in logs:
            bookie = l.get('bookie')
            if bookie:
                ts = l.get('timestamp')
                if bookie not in bookie_first_ts or (ts and ts < bookie_first_ts[bookie]):
                    bookie_first_ts[bookie] = ts
        books = [b for b, _ in sorted(bookie_first_ts.items(), key=lambda x: (x[1] or '', x[0]))]

        book_abbrs = [get_book_abbr(b) for b in books]
        bet['books_list'] = ', '.join(book_abbrs) if book_abbrs else get_book_abbr(bet.get('bookie', ''))

        bets.append(bet)

    conn.close()

    if not group_by_tournament:
        return bets

    # Group by tournament
    grouped = {}
    for bet in bets:
        tournament = bet['tournament_name']
        if tournament not in grouped:
            grouped[tournament] = []
        grouped[tournament].append(bet)

    return grouped


def get_bet_logs(bet_id):
    """
    Get all individual log entries for a bet, plus the bet itself.
    Groups bet_logs by bookie and calculates per-book aggregates.

    Returns:
        Tuple of (bet dict, grouped books dict)
    """
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute('SELECT * FROM ncaa_bets WHERE id = %s', (bet_id,))
    bet_row = cursor.fetchone()

    cursor.execute('''
        SELECT * FROM ncaa_bet_logs WHERE bet_id = %s ORDER BY timestamp ASC
    ''', (bet_id,))

    log_rows = cursor.fetchall()
    conn.close()

    bet = bet_row if bet_row else None
    logs = list(log_rows)

    # Group logs by bookie and calculate per-book aggregates
    books = {}
    for log in logs:
        bookie = log.get('bookie', 'Unknown')

        if bookie not in books:
            books[bookie] = {
                'total_stake': 0,
                'total_filled': 0,
                'total_shares_bid': 0,
                'total_shares_filled': 0,
                'weighted_odds': 0,
                'bet_logs': []
            }

        log_stake = log.get('stake_added', 0)
        log_filled = log.get('filled_added', 0) or 0
        log_fin = log.get('is_finalized', 0) or 0
        if not (log_fin and log_filled == 0 and log_stake > 0):
            books[bookie]['total_stake'] += log_stake
        books[bookie]['total_filled'] += log_filled
        books[bookie]['total_shares_bid'] += log.get('shares_bid', 0) or 0
        books[bookie]['total_shares_filled'] += log.get('shares_filled', 0) or 0
        books[bookie]['bet_logs'].append(log)

    # Calculate weighted average odds for each book
    for bookie, book_data in books.items():
        total_weighted_odds = 0
        total_weight = 0

        for log in book_data['bet_logs']:
            filled = log.get('filled_added', 0) or 0
            odds = log.get('odds', 0)

            if filled > 0:
                total_weighted_odds += odds * filled
                total_weight += filled

        if total_weight > 0:
            book_data['weighted_odds'] = total_weighted_odds / total_weight
        else:
            for log in book_data['bet_logs']:
                stake = log.get('stake_added', 0)
                odds = log.get('odds', 0)
                if stake > 0:
                    total_weighted_odds += odds * stake
                    total_weight += stake

            if total_weight > 0:
                book_data['weighted_odds'] = total_weighted_odds / total_weight
            else:
                book_data['weighted_odds'] = 0

    return bet, books


def finalize_bet_log(log_id):
    """Set is_finalized = 1 for a bet_log entry."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT id FROM ncaa_bet_logs WHERE id = %s', (log_id,))
    if not cursor.fetchone():
        conn.close()
        raise ValueError(f"Bet log #{log_id} not found")
    cursor.execute('UPDATE ncaa_bet_logs SET is_finalized = 1 WHERE id = %s', (log_id,))
    conn.commit()
    conn.close()
    print(f"Finalized bet_log #{log_id}")
    return {'success': True}


def unfinalize_bet_log(log_id):
    """Set is_finalized = 0 for a bet_log entry."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT id FROM ncaa_bet_logs WHERE id = %s', (log_id,))
    if not cursor.fetchone():
        conn.close()
        raise ValueError(f"Bet log #{log_id} not found")
    cursor.execute('UPDATE ncaa_bet_logs SET is_finalized = 0 WHERE id = %s', (log_id,))
    conn.commit()
    conn.close()
    print(f"Unfinalized bet_log #{log_id}")
    return True


def update_bet_log_field(log_id, field, value):
    """Update a single field on a bet_log entry, then recalculate parent bet totals."""
    allowed_fields = ['stake_added', 'filled_added', 'shares_bid', 'shares_filled', 'odds', 'bid_price', 'bookie', 'notes']
    if field not in allowed_fields:
        raise ValueError(f"Field '{field}' not allowed")

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute('SELECT bet_id, is_finalized FROM ncaa_bet_logs WHERE id = %s', (log_id,))
    log = cursor.fetchone()
    if not log:
        conn.close()
        raise ValueError(f"Bet log #{log_id} not found")

    if log['is_finalized']:
        conn.close()
        raise ValueError(f"Bet log #{log_id} is finalized and cannot be edited")

    cursor.execute(f'UPDATE ncaa_bet_logs SET {field} = %s WHERE id = %s', (value, log_id))
    conn.commit()

    bet_id = log['bet_id']
    _recalculate_bet_totals(cursor, bet_id)
    conn.commit()
    conn.close()
    print(f"Updated bet_log #{log_id} {field} = {value}")
    return bet_id


def update_bet_field(bet_id, field, value):
    """Update a single field on a bet entry."""
    allowed = ['notes']
    if field not in allowed:
        raise ValueError(f"Field '{field}' not allowed on bets")
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(f'UPDATE ncaa_bets SET {field} = %s WHERE id = %s', (value, bet_id))
    conn.commit()
    conn.close()
    return bet_id


def update_bet_fill(bet_id, filled_amount, bid_price=None):
    """Update the filled amount for a limit order bet."""
    conn = get_connection()
    cursor = conn.cursor()
    if bid_price is not None:
        cursor.execute('UPDATE ncaa_bets SET filled_amount = %s, bid_price = %s WHERE id = %s',
                       (filled_amount, bid_price, bet_id))
    else:
        cursor.execute('UPDATE ncaa_bets SET filled_amount = %s WHERE id = %s',
                       (filled_amount, bet_id))
    conn.commit()
    conn.close()
    print(f"Updated bet #{bet_id} fill: ${filled_amount}")


def delete_bet(bet_id, username):
    """
    Delete a bet and all its associated logs.
    If the bet was graded (status='Closed') with non-zero P/L,
    reverse the bankroll impact before deleting.
    """
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute('SELECT status, profit_loss, grading_bankroll_delta, result, sport_category FROM ncaa_bets WHERE id = %s AND username = %s', (bet_id, username))
    bet = cursor.fetchone()

    if not bet:
        conn.close()
        raise ValueError(f"Bet #{bet_id} not found")

    profit_loss = bet['profit_loss'] or 0

    # Calculate the ACTUAL total bankroll impact to reverse
    bankroll_reversal = 0
    if bet['status'] == 'Closed' and bet['result'] != 'Sold':
        cursor.execute('''
            SELECT COALESCE(SUM(filled_added), 0) FROM ncaa_bet_logs
            WHERE bet_id = %s AND shares_filled < 0
        ''', (bet_id,))
        close_pl = cursor.fetchone()['coalesce']

        grading_delta = bet['grading_bankroll_delta']
        if grading_delta is not None:
            bankroll_reversal = grading_delta + close_pl
        else:
            bankroll_reversal = profit_loss + close_pl
    elif bet['status'] == 'Closed' and bet['result'] == 'Sold':
        cursor.execute('''
            SELECT COALESCE(SUM(filled_added), 0) FROM ncaa_bet_logs
            WHERE bet_id = %s AND shares_filled < 0
        ''', (bet_id,))
        close_pl = cursor.fetchone()['coalesce']
        bankroll_reversal = close_pl
    elif bet['status'] == 'Open' and profit_loss != 0:
        cursor.execute('''
            SELECT COALESCE(SUM(filled_added), 0) FROM ncaa_bet_logs
            WHERE bet_id = %s AND shares_filled < 0
        ''', (bet_id,))
        close_pl = cursor.fetchone()['coalesce']
        bankroll_reversal = close_pl

    # Record P/L adjustment for graded bets
    if bet['status'] == 'Closed' and abs(profit_loss) > 0.001:
        category = bet.get('sport_category') or 'NCAAB'
        cursor.execute('''
            INSERT INTO ncaa_deleted_bet_adjustments (category, amount, description, username)
            VALUES (%s, %s, %s, %s)
        ''', (category, -profit_loss, f'Deleted bet #{bet_id}', username))

    # Delete bet logs first (foreign key constraint)
    cursor.execute('DELETE FROM ncaa_bet_logs WHERE bet_id = %s', (bet_id,))
    cursor.execute('DELETE FROM ncaa_bets WHERE id = %s', (bet_id,))

    conn.commit()
    conn.close()

    # Reverse bankroll impact
    if abs(bankroll_reversal) > 0.001:
        new_bankroll = update_bankroll(-bankroll_reversal, username)
        print(f"Deleted bet #{bet_id} and all associated logs. Reversed bankroll ${bankroll_reversal:.2f}, New bankroll: ${new_bankroll:.2f}")
    else:
        print(f"Deleted bet #{bet_id} and all associated logs")


def delete_bet_log(log_id):
    """Delete a specific bet log entry and recalculate bet totals."""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute('SELECT * FROM ncaa_bet_logs WHERE id = %s', (log_id,))
    log = cursor.fetchone()

    if not log:
        conn.close()
        raise ValueError(f"Bet log #{log_id} not found")

    bet_id = log['bet_id']

    # Look up the bet's username for any future bankroll operations
    cursor.execute('SELECT username FROM ncaa_bets WHERE id = %s', (bet_id,))
    bet_row = cursor.fetchone()
    username = bet_row['username'] if bet_row else None

    cursor.execute('DELETE FROM ncaa_bet_logs WHERE id = %s', (log_id,))

    cursor.execute('SELECT * FROM ncaa_bet_logs WHERE bet_id = %s ORDER BY timestamp ASC', (bet_id,))
    remaining_logs = cursor.fetchall()

    if len(remaining_logs) == 0:
        cursor.execute('DELETE FROM ncaa_bets WHERE id = %s', (bet_id,))
        print(f"Deleted bet #{bet_id} (no logs remaining)")
    else:
        _recalculate_bet_totals(cursor, bet_id)
        print(f"Deleted log #{log_id} and recalculated bet #{bet_id}")

    conn.commit()
    conn.close()


def _recalculate_bet_totals(cursor, bet_id):
    """
    Internal helper to recalculate bet totals from its bet_logs.
    Used after modifying bet_logs to ensure parent bet is in sync.
    """
    cursor.execute('SELECT * FROM ncaa_bet_logs WHERE bet_id = %s ORDER BY timestamp ASC', (bet_id,))
    logs = cursor.fetchall()

    if not logs:
        return

    total_stake = 0
    total_filled = 0
    weighted_odds_sum = 0
    weighted_bid_price_sum = 0
    total_weight = 0

    for log_entry in logs:
        stake = log_entry['stake_added']
        filled = log_entry['filled_added'] or 0
        odds = log_entry['odds']
        bid_price = log_entry['bid_price']

        is_fin = log_entry['is_finalized'] or 0
        if not (is_fin and filled == 0 and stake > 0):
            total_stake += stake
        total_filled += filled

        # Only use POSITIVE entries for weighted averages
        if stake > 0 or filled > 0:
            weight = filled if filled > 0 else stake
            total_weight += weight

            weighted_odds_sum += odds * weight
            if bid_price is not None:
                weighted_bid_price_sum += bid_price * weight

    weighted_avg_odds = weighted_odds_sum / total_weight if total_weight > 0 else logs[0]['odds']
    weighted_avg_bid_price = weighted_bid_price_sum / total_weight if total_weight > 0 else None

    latest_log = logs[-1]

    cursor.execute('''
        UPDATE ncaa_bets
        SET actual_stake = %s,
            filled_amount = %s,
            book_odds = %s,
            bid_price = %s,
            fair_odds = %s,
            edge_percent = %s,
            timestamp = %s
        WHERE id = %s
    ''', (
        total_stake,
        total_filled if total_filled > 0 else None,
        weighted_avg_odds,
        weighted_avg_bid_price,
        latest_log['fair_odds'],
        latest_log['edge_percent'],
        latest_log['timestamp'],
        bet_id
    ))


# ============================================================
# Grading
# ============================================================

def grade_bet(bet_id, result, username, adjusted_odds=None):
    """
    Grade a bet and update bankroll.

    For PM bets with prior closes:
    - Queries bet_logs to get original_cost, sale_proceeds, remaining_shares
    - Grading payout applies only to remaining_shares
    - Total P&L = sale_proceeds + grading_payout - original_cost

    Args:
        bet_id: ID of the bet to grade
        result: 'Won', 'Lost', 'Push', or 'Dead Heat'
        username: The username whose bankroll to update
        adjusted_odds: For Dead Heat, the adjusted decimal odds to use

    Returns:
        Dict with updated bet and new bankroll
    """
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute('SELECT * FROM ncaa_bets WHERE id = %s', (bet_id,))
    bet_row = cursor.fetchone()

    if not bet_row:
        conn.close()
        raise ValueError(f'Bet #{bet_id} not found')

    bet = dict(bet_row) if bet_row else None

    if bet['status'] == 'Closed':
        conn.close()
        raise ValueError(f'Bet #{bet_id} is already graded')

    # Query bet_logs to get accurate position data (including closes)
    cursor.execute('''
        SELECT filled_added, shares_filled, is_prediction_market, odds, notes
        FROM ncaa_bet_logs
        WHERE bet_id = %s
    ''', (bet_id,))
    logs = cursor.fetchall()

    # Detect closing position
    is_closing_position = any('CLOSE MIRROR' in (log['notes'] or '') for log in logs)

    # Split bet_logs into PM and traditional buckets
    pm_original_cost = 0
    pm_sale_proceeds = 0
    pm_original_shares = 0
    pm_remaining_shares = 0
    has_pm_logs = False

    trad_buy_logs = []
    trad_sale_proceeds = 0
    has_trad_logs = False

    for log in logs:
        filled = log['filled_added'] or 0
        shares = log['shares_filled'] or 0
        is_pm = log['is_prediction_market'] or 0
        odds = log['odds'] or 0

        if is_pm:
            has_pm_logs = True
            if filled > 0:
                pm_original_cost += filled
            elif filled < 0:
                pm_sale_proceeds += abs(filled)
            if shares > 0:
                pm_original_shares += shares
            pm_remaining_shares += shares
        else:
            if filled > 0:
                has_trad_logs = True
                trad_buy_logs.append((filled, odds))
            elif filled < 0:
                trad_sale_proceeds += abs(filled)

    has_pm_component = has_pm_logs or (bet['bid_price'] is not None and bet['bid_price'] > 0)
    has_trad_component = has_trad_logs

    original_cost = pm_original_cost + sum(f for f, o in trad_buy_logs)
    sale_proceeds = pm_sale_proceeds + trad_sale_proceeds
    original_shares = pm_original_shares

    # --- Calculate PM component P&L ---
    pm_profit_loss = 0
    pm_grading_payout = 0
    if has_pm_component and (pm_original_cost > 0 or pm_sale_proceeds > 0):
        if result == 'Won':
            pm_grading_payout = pm_remaining_shares
        elif result == 'Lost':
            pm_grading_payout = 0
        elif result == 'Push':
            if pm_original_cost > 0 and (pm_original_cost - pm_sale_proceeds) > 0:
                pm_grading_payout = pm_original_cost - pm_sale_proceeds
            else:
                pm_grading_payout = 0
        elif result == 'Dead Heat':
            if adjusted_odds and adjusted_odds > 0:
                pm_grading_payout = pm_original_cost * adjusted_odds
            else:
                pm_grading_payout = pm_remaining_shares / 2
        else:
            conn.close()
            raise ValueError(f'Invalid result: {result}')
        pm_profit_loss = pm_sale_proceeds + pm_grading_payout - pm_original_cost

    # --- Calculate Traditional component P&L ---
    trad_profit_loss = 0
    if has_trad_component:
        trad_total_stake = sum(f for f, o in trad_buy_logs)
        if result == 'Won':
            for filled, odds in trad_buy_logs:
                trad_profit_loss += filled * (odds - 1)
        elif result == 'Lost':
            trad_profit_loss = -trad_total_stake
        elif result == 'Push':
            trad_profit_loss = 0
        elif result == 'Dead Heat':
            if adjusted_odds and adjusted_odds > 0:
                for filled, odds in trad_buy_logs:
                    trad_profit_loss += filled * (adjusted_odds - 1)
            else:
                for filled, odds in trad_buy_logs:
                    trad_profit_loss += filled * (odds - 1) / 2
        else:
            conn.close()
            raise ValueError(f'Invalid result: {result}')
    elif not has_pm_component:
        # Pure traditional bet with no bet_logs having filled_added > 0
        filled = bet['filled_amount']
        stake = filled if filled and filled > 0 else (bet['actual_stake'] or 0)
        book_odds = adjusted_odds if (result == 'Dead Heat' and adjusted_odds) else bet['book_odds']
        if result == 'Won':
            trad_profit_loss = stake * (book_odds - 1)
        elif result == 'Lost':
            trad_profit_loss = -stake
        elif result == 'Push':
            trad_profit_loss = 0
        elif result == 'Dead Heat':
            if adjusted_odds and adjusted_odds > 0:
                trad_profit_loss = stake * (adjusted_odds - 1)
            else:
                trad_profit_loss = stake * (book_odds - 1) / 2
        else:
            conn.close()
            raise ValueError(f'Invalid result: {result}')

    # --- Combine ---
    profit_loss = pm_profit_loss + trad_profit_loss

    # Closing positions: P&L was already captured on the opposite bet via CLOSE MIRROR.
    if is_closing_position:
        profit_loss = 0

    # Compute bankroll delta
    grading_bankroll_delta = 0

    if has_pm_component and (pm_original_cost > 0 or pm_sale_proceeds > 0):
        if pm_sale_proceeds > 0 and pm_original_shares > 0:
            pm_remaining_cost = pm_original_cost * (pm_remaining_shares / pm_original_shares)
            if pm_remaining_cost < 0:
                pm_remaining_cost = 0
            pm_grading_bankroll = pm_grading_payout - pm_remaining_cost if result != 'Push' else 0
        else:
            pm_grading_bankroll = pm_profit_loss
        grading_bankroll_delta += pm_grading_bankroll

    if has_trad_component:
        if trad_sale_proceeds > 0:
            trad_total_equiv = sum(f * o for f, o in trad_buy_logs)
            if trad_total_equiv > 0:
                remaining_frac = max(0, 1 - (trad_sale_proceeds / sum(f for f, o in trad_buy_logs)))
                trad_grading_bankroll = trad_profit_loss * remaining_frac
            else:
                trad_grading_bankroll = trad_profit_loss
        else:
            trad_grading_bankroll = trad_profit_loss
        grading_bankroll_delta += trad_grading_bankroll
    elif not has_pm_component:
        grading_bankroll_delta += trad_profit_loss

    if is_closing_position:
        grading_bankroll_delta = 0

    graded_at = datetime.now().isoformat()
    stored_odds = adjusted_odds if (result == 'Dead Heat' and adjusted_odds and adjusted_odds > 0) else bet['book_odds']

    try:
        cursor.execute('''
            UPDATE ncaa_bets
            SET status = 'Closed', result = %s, profit_loss = %s, graded_at = %s,
                grading_bankroll_delta = %s, book_odds = %s
            WHERE id = %s
        ''', (result, profit_loss, graded_at, grading_bankroll_delta, stored_odds, bet_id))

        if result == 'Dead Heat' and adjusted_odds and adjusted_odds > 0:
            cursor.execute('''
                UPDATE ncaa_bet_logs SET odds = %s WHERE bet_id = %s
            ''', (adjusted_odds, bet_id))

        current_bankroll = get_bankroll(username)
        new_bankroll = current_bankroll + grading_bankroll_delta
        cursor.execute('''
            INSERT INTO ncaa_config (key, value) VALUES (%s, %s)
            ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
        ''', (f'bankroll_{username}', str(new_bankroll)))

        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

    print(f"Graded bet #{bet_id}: {result}, P/L: ${profit_loss:.2f}, New bankroll: ${new_bankroll:.2f}")

    return {
        'bet_id': bet_id,
        'result': result,
        'profit_loss': profit_loss,
        'graded_at': graded_at,
        'new_bankroll': new_bankroll
    }


def ungrade_bet(bet_id, username):
    """Ungrade a bet and reverse bankroll change."""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute('SELECT * FROM ncaa_bets WHERE id = %s', (bet_id,))
    bet_row = cursor.fetchone()

    if not bet_row:
        conn.close()
        raise ValueError(f'Bet #{bet_id} not found')

    bet = dict(bet_row) if bet_row else None

    if bet['status'] != 'Closed':
        conn.close()
        raise ValueError(f'Bet #{bet_id} is not graded')

    if bet['result'] == 'Sold':
        conn.close()
        raise ValueError(f'Bet #{bet_id} was sold and cannot be ungraded')

    bankroll_delta = bet.get('grading_bankroll_delta')
    if bankroll_delta is None:
        bankroll_delta = bet['profit_loss'] or 0
    profit_loss = bet['profit_loss'] or 0

    # Calculate accumulated close P/L from bet_logs
    cursor.execute('''
        SELECT COALESCE(SUM(filled_added), 0) FROM ncaa_bet_logs
        WHERE bet_id = %s AND shares_filled < 0
    ''', (bet_id,))
    close_pl = cursor.fetchone()['coalesce']

    try:
        cursor.execute('''
            UPDATE ncaa_bets
            SET status = 'Open', result = NULL, profit_loss = %s, graded_at = NULL,
                grading_bankroll_delta = NULL
            WHERE id = %s
        ''', (close_pl if abs(close_pl) > 0.001 else None, bet_id))

        current_bankroll = get_bankroll(username)
        new_bankroll = current_bankroll - bankroll_delta
        cursor.execute('''
            INSERT INTO ncaa_config (key, value) VALUES (%s, %s)
            ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
        ''', (f'bankroll_{username}', str(new_bankroll)))

        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

    print(f"Ungraded bet #{bet_id}: Reversed bankroll delta ${bankroll_delta:.2f}, New bankroll: ${new_bankroll:.2f}")

    return {
        'bet_id': bet_id,
        'reversed_pl': profit_loss,
        'reversed_delta': bankroll_delta,
        'close_pl_preserved': close_pl,
        'new_bankroll': new_bankroll
    }


# ============================================================
# Position Close Logic
# ============================================================

def find_opposite_position(player_name, tournament_name, market_type, side, bookie, username):
    """
    Find an existing opposite position for a PM bet.
    For PM closes: allows cross-platform (Kalshi can close Poly and vice versa).
    Pecking order: same platform first, then other PM platforms (oldest first).

    Returns:
        Dict with position details if found, None otherwise
    """
    conn = get_connection()
    cursor = conn.cursor()

    opposite_side = 'NO' if side.upper() == 'YES' else 'YES'

    bookie_lower = (bookie or '').lower()
    if 'kalshi' in bookie_lower:
        bookie_match = 'kalshi'
        is_pm_close = True
    elif 'poly' in bookie_lower:
        bookie_match = 'poly'
        is_pm_close = True
    else:
        bookie_match = bookie_lower
        is_pm_close = False

    cursor.execute('''
        SELECT id, player_name, tournament_name, market_type, side, bookie,
               filled_amount, bid_price
        FROM ncaa_bets
        WHERE status = 'Open'
        AND LOWER(player_name) = LOWER(%s)
        AND LOWER(tournament_name) = LOWER(%s)
        AND LOWER(market_type) = LOWER(%s)
        AND UPPER(side) = %s
        AND username = %s
    ''', (player_name, tournament_name, market_type, opposite_side, username))

    candidates = cursor.fetchall()

    pm_candidates = []

    for candidate in candidates:
        candidate_id = candidate['id']

        cursor.execute('''
            SELECT DISTINCT bookie FROM ncaa_bet_logs
            WHERE bet_id = %s AND (shares_filled > 0 OR (is_prediction_market = 0 AND filled_added > 0))
        ''', (candidate_id,))
        log_bookies = cursor.fetchall()

        has_same_platform = False
        has_any_pm = False
        has_traditional = False
        for log_row in log_bookies:
            log_bookie = (log_row['bookie'] or '').lower()
            if 'kalshi' in log_bookie:
                log_match = 'kalshi'
                has_any_pm = True
            elif 'poly' in log_bookie:
                log_match = 'poly'
                has_any_pm = True
            else:
                log_match = log_bookie
                has_traditional = True

            if log_match == bookie_match:
                has_same_platform = True

        if is_pm_close:
            if has_any_pm:
                pm_candidates.append((dict(candidate), has_same_platform, candidate_id, False))
            elif has_traditional:
                pm_candidates.append((dict(candidate), False, candidate_id, True))
        else:
            if has_same_platform:
                pm_candidates.append((dict(candidate), True, candidate_id, False))

    pm_candidates.sort(key=lambda x: (0 if x[1] else (2 if x[3] else 1), x[2]))

    matching_bet = pm_candidates[0][0] if pm_candidates else None

    if not matching_bet:
        conn.close()
        return None

    bet_id = matching_bet['id']

    # Get net shares from bet_logs
    is_traditional_match = False

    if is_pm_close:
        cursor.execute('''
            SELECT DISTINCT bookie FROM ncaa_bet_logs
            WHERE bet_id = %s AND shares_filled > 0
        ''', (bet_id,))
        matched_bookies = cursor.fetchall()

        platforms_to_close = []
        for row in matched_bookies:
            b = (row['bookie'] or '').lower()
            if 'kalshi' in b:
                platforms_to_close.append('%kalshi%')
            elif 'poly' in b:
                platforms_to_close.append('%poly%')

        if platforms_to_close:
            placeholders = ' OR '.join(['LOWER(bookie) LIKE %s' for _ in platforms_to_close])
            cursor.execute(f'''
                SELECT SUM(shares_filled) as total_shares, SUM(filled_added) as total_filled
                FROM ncaa_bet_logs
                WHERE bet_id = %s
                AND ({placeholders})
            ''', (bet_id, *platforms_to_close))
            totals = cursor.fetchone()
            total_shares = totals['total_shares'] or 0
            total_filled = totals['total_filled'] or 0
        else:
            is_traditional_match = True
    else:
        cursor.execute('''
            SELECT SUM(shares_filled) as total_shares, SUM(filled_added) as total_filled
            FROM ncaa_bet_logs
            WHERE bet_id = %s
            AND (LOWER(bookie) LIKE %s OR LOWER(bookie) LIKE %s)
        ''', (bet_id, f'%{bookie_match}%', f'%{bookie_match}%'))
        totals = cursor.fetchone()
        total_shares = totals['total_shares'] or 0
        total_filled = totals['total_filled'] or 0

    if is_traditional_match:
        cursor.execute('''
            SELECT equivalent_shares, price_per_share, filled_amount
            FROM ncaa_bets WHERE id = %s
        ''', (bet_id,))
        trad_bet = cursor.fetchone()
        equiv_shares = trad_bet['equivalent_shares'] or 0
        price_per_share = trad_bet['price_per_share'] or 0
        filled_amt = trad_bet['filled_amount'] or 0

        if equiv_shares <= 0 or price_per_share <= 0:
            cursor.execute('''
                SELECT filled_added, odds FROM ncaa_bet_logs
                WHERE bet_id = %s AND is_prediction_market = 0 AND filled_added > 0
            ''', (bet_id,))
            trad_logs = cursor.fetchall()
            if not trad_logs:
                conn.close()
                return None
            total_trad_shares = 0
            total_trad_cost = 0
            for log in trad_logs:
                filled = log['filled_added']
                odds = log['odds']
                shares = filled * odds
                total_trad_shares += shares
                total_trad_cost += filled
            if total_trad_shares <= 0:
                conn.close()
                return None
            equiv_shares = total_trad_shares
            price_per_share = (total_trad_cost / total_trad_shares) * 100
            filled_amt = total_trad_cost

        cursor.execute('''
            SELECT COALESCE(SUM(shares_filled), 0) as closed_shares
            FROM ncaa_bet_logs WHERE bet_id = %s AND shares_filled < 0
        ''', (bet_id,))
        closed_shares = cursor.fetchone()['closed_shares']
        remaining_shares = equiv_shares + closed_shares

        if remaining_shares <= 0:
            conn.close()
            return None

        conn.close()

        return {
            'bet_id': bet_id,
            'shares': remaining_shares,
            'avg_price': price_per_share,
            'filled_amount': filled_amt,
            'side': opposite_side,
            'is_traditional': True
        }

    if total_shares <= 0:
        # Check for traditional exposure on hybrid bet
        cursor.execute('''
            SELECT filled_added, odds FROM ncaa_bet_logs
            WHERE bet_id = %s AND is_prediction_market = 0 AND filled_added > 0
        ''', (bet_id,))
        trad_logs = cursor.fetchall()

        if trad_logs:
            total_trad_shares = 0
            total_trad_cost = 0
            for log in trad_logs:
                filled = log['filled_added']
                odds = log['odds']
                shares = filled * odds
                total_trad_shares += shares
                total_trad_cost += filled

            cursor.execute('''
                SELECT COALESCE(SUM(shares_filled), 0) FROM ncaa_bet_logs
                WHERE bet_id = %s AND is_prediction_market = 0 AND shares_filled < 0
            ''', (bet_id,))
            prior_closes = cursor.fetchone()['coalesce']

            remaining_trad = total_trad_shares + prior_closes

            if remaining_trad > 0.01:
                avg_price = (total_trad_cost / total_trad_shares) * 100
                conn.close()
                return {
                    'bet_id': bet_id,
                    'shares': remaining_trad,
                    'avg_price': avg_price,
                    'side': opposite_side,
                    'is_traditional': True
                }

        conn.close()
        return None

    # Get original cost basis from POSITIVE entries only
    if is_pm_close and platforms_to_close:
        placeholders = ' OR '.join(['LOWER(bookie) LIKE %s' for _ in platforms_to_close])
        cursor.execute(f'''
            SELECT SUM(shares_filled) as buy_shares, SUM(filled_added) as buy_filled
            FROM ncaa_bet_logs
            WHERE bet_id = %s
            AND ({placeholders})
            AND shares_filled > 0
        ''', (bet_id, *platforms_to_close))
    else:
        cursor.execute('''
            SELECT SUM(shares_filled) as buy_shares, SUM(filled_added) as buy_filled
            FROM ncaa_bet_logs
            WHERE bet_id = %s
            AND (LOWER(bookie) LIKE %s OR LOWER(bookie) LIKE %s)
            AND shares_filled > 0
        ''', (bet_id, f'%{bookie_match}%', f'%{bookie_match}%'))

    buy_totals = cursor.fetchone()
    buy_shares = buy_totals['buy_shares'] or 0
    buy_filled = buy_totals['buy_filled'] or 0

    avg_price = (buy_filled / buy_shares) * 100 if buy_shares > 0 else 0

    conn.close()

    return {
        'bet_id': bet_id,
        'shares': total_shares,
        'avg_price': avg_price,
        'filled_amount': total_filled,
        'side': opposite_side
    }


def close_pm_position(close_data, book, username, order_type='taker'):
    """
    Close (fully or partially) a prediction market position.

    Args:
        close_data: Dict with close_bet_id, close_shares, close_price, existing_avg_price
        book: The book name
        username: The username whose bankroll to update
        order_type: 'taker' or 'maker'

    Returns:
        Dict with close results including profit_loss and whether fully closed
    """
    conn = get_connection()
    cursor = conn.cursor()

    bet_id = close_data['close_bet_id']
    shares_to_close = close_data['close_shares']
    close_price = close_data['close_price']  # cents

    cursor.execute('SELECT * FROM ncaa_bets WHERE id = %s', (bet_id,))
    bet_row = cursor.fetchone()

    if not bet_row:
        conn.close()
        raise ValueError(f'Bet #{bet_id} not found')

    bet = dict(bet_row) if bet_row else None

    if bet['status'] != 'Open':
        conn.close()
        raise ValueError(f'Bet #{bet_id} is not open')

    # Detect if this bet has active PM shares
    cursor.execute('''
        SELECT COALESCE(SUM(shares_filled), 0) FROM ncaa_bet_logs
        WHERE bet_id = %s AND is_prediction_market = 1
    ''', (bet_id,))
    net_pm_shares = cursor.fetchone()['coalesce']
    is_traditional_bet = net_pm_shares <= 0

    if is_traditional_bet:
        cursor.execute('''
            SELECT filled_added, odds FROM ncaa_bet_logs
            WHERE bet_id = %s AND is_prediction_market = 0 AND filled_added > 0
        ''', (bet_id,))
        trad_logs = cursor.fetchall()

        if not trad_logs:
            conn.close()
            return {'success': False, 'error': f'Bet #{bet_id} has no traditional bet_logs'}

        total_trad_shares = 0
        total_trad_cost = 0
        for log in trad_logs:
            filled = log['filled_added']
            odds = log['odds']
            shares = filled * odds
            total_trad_shares += shares
            total_trad_cost += filled

        cursor.execute('''
            SELECT COALESCE(SUM(shares_filled), 0) FROM ncaa_bet_logs
            WHERE bet_id = %s AND is_prediction_market = 0 AND shares_filled < 0
        ''', (bet_id,))
        prior_closed = cursor.fetchone()['coalesce']
        existing_shares = total_trad_shares + prior_closed
        existing_avg_price = (total_trad_cost / total_trad_shares) * 100
    else:
        cursor.execute('''
            SELECT SUM(shares_filled) as total_shares, SUM(filled_added) as total_filled
            FROM ncaa_bet_logs WHERE bet_id = %s
        ''', (bet_id,))
        totals = cursor.fetchone()
        existing_shares = totals['total_shares'] or 0

        cursor.execute('''
            SELECT SUM(shares_filled) as buy_shares, SUM(filled_added) as buy_filled
            FROM ncaa_bet_logs
            WHERE bet_id = %s AND shares_filled > 0
        ''', (bet_id,))
        buy_totals = cursor.fetchone()
        buy_shares = buy_totals['buy_shares'] or 0
        buy_filled = buy_totals['buy_filled'] or 0

        if buy_shares <= 0:
            conn.close()
            raise ValueError(f'Bet #{bet_id} has no positive entries - cannot calculate cost basis')

        existing_avg_price = (buy_filled / buy_shares) * 100

    shares_to_close = min(shares_to_close, existing_shares)
    if shares_to_close <= 0:
        conn.close()
        return {'success': False, 'error': 'No shares to close'}

    remaining_shares = existing_shares - shares_to_close

    if is_traditional_bet:
        is_full_close = remaining_shares < 0.01
    else:
        has_traditional_exposure = False
        cursor.execute('''
            SELECT COUNT(*) FROM ncaa_bet_logs
            WHERE bet_id = %s AND is_prediction_market = 0 AND filled_added > 0
        ''', (bet_id,))
        trad_check = cursor.fetchone()['count']
        if trad_check > 0:
            has_traditional_exposure = True
        is_full_close = remaining_shares < 0.01 and not has_traditional_exposure

    # Calculate P&L
    close_proceeds = shares_to_close * close_price / 100
    close_cost = shares_to_close * existing_avg_price / 100
    profit_loss = close_proceeds - close_cost

    graded_at = datetime.now().isoformat()

    close_filled = shares_to_close * close_price / 100
    close_is_pm = 0 if is_traditional_bet else 1
    cursor.execute('''
        INSERT INTO ncaa_bet_logs (
            bet_id, timestamp, stake_added, filled_added, odds, bid_price,
            fair_odds, edge_percent, bookie, shares_bid, shares_filled,
            is_prediction_market, is_finalized, notes
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    ''', (
        bet_id,
        graded_at,
        -close_filled,
        -close_filled,
        100 / close_price if close_price > 0 else 0,
        close_price,
        0,
        0,
        book,
        -shares_to_close,
        -shares_to_close,
        close_is_pm,
        1,
        f'CLOSE: {shares_to_close} shares @ {close_price:.1f}¢, P&L: ${profit_loss:.2f}'
    ))

    current_pl = bet['profit_loss'] or 0
    total_pl = current_pl + profit_loss

    if is_full_close:
        cursor.execute('''
            UPDATE ncaa_bets
            SET status = 'Closed', result = 'Sold', profit_loss = %s, graded_at = %s
            WHERE id = %s
        ''', (total_pl, graded_at, bet_id))
    else:
        cursor.execute('''
            UPDATE ncaa_bets SET profit_loss = %s WHERE id = %s
        ''', (total_pl, bet_id))

    _recalculate_bet_totals(cursor, bet_id)

    conn.commit()
    conn.close()

    new_bankroll = update_bankroll(profit_loss, username)

    close_type = 'fully' if is_full_close else 'partially'
    print(f"Closed {close_type} bet #{bet_id}: {shares_to_close} shares @ {close_price:.1f}¢, P&L: ${profit_loss:.2f}")

    return {
        'success': True,
        'bet_id': bet_id,
        'shares_closed': shares_to_close,
        'close_price': close_price,
        'profit_loss': profit_loss,
        'fee_amount': 0,
        'is_full_close': is_full_close,
        'new_bankroll': new_bankroll
    }


# ============================================================
# P/L Adjustments
# ============================================================

def get_pl_adjustments(username):
    """Get sum of P/L adjustments from deleted bets, grouped by category."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT category, SUM(amount) as total
        FROM ncaa_deleted_bet_adjustments
        WHERE username = %s
        GROUP BY category
    ''', (username,))
    rows = cursor.fetchall()
    conn.close()
    return {row['category']: row['total'] for row in rows}


def get_bet_summary(username):
    """Get summary statistics for all bets for a specific user."""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) as total FROM ncaa_bets WHERE username = %s", (username,))
    total = cursor.fetchone()['total']

    cursor.execute("SELECT COUNT(*) as open_count FROM ncaa_bets WHERE username = %s AND status = 'Open'", (username,))
    open_count = cursor.fetchone()['open_count']

    cursor.execute("SELECT COUNT(*) as closed FROM ncaa_bets WHERE username = %s AND status = 'Closed'", (username,))
    closed = cursor.fetchone()['closed']

    cursor.execute("SELECT COALESCE(SUM(profit_loss), 0) as total_pl FROM ncaa_bets WHERE username = %s AND status = 'Closed'", (username,))
    total_pl = cursor.fetchone()['total_pl']

    cursor.execute("SELECT COUNT(*) as won FROM ncaa_bets WHERE username = %s AND result = 'Won'", (username,))
    won = cursor.fetchone()['won']

    cursor.execute("SELECT COUNT(*) as lost FROM ncaa_bets WHERE username = %s AND result = 'Lost'", (username,))
    lost = cursor.fetchone()['lost']

    conn.close()

    return {
        'total_bets': total,
        'open_bets': open_count,
        'closed_bets': closed,
        'total_pl': total_pl,
        'won': won,
        'lost': lost,
        'win_rate': (won / (won + lost) * 100) if (won + lost) > 0 else 0
    }
