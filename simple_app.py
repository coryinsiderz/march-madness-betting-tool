"""
Simple Flask web app for NCAA March Madness betting tool.
Multi-user via name-based sessions (no passwords).
"""

from flask import Flask, render_template, request, jsonify, redirect, url_for, session
import os
import traceback
from database import (
    init_db, log_bet, get_active_bets, get_bet_summary, get_pl_adjustments,
    create_event, get_events, delete_event, archive_event,
    grade_bet, ungrade_bet, get_bankroll, get_config, set_config,
    close_pm_position, find_opposite_position, _recalculate_bet_totals
)
from utils.odds_converter import convert_to_decimal, convert_to_american, decimal_to_american

app = Flask(__name__)

# Disable template caching for development
app.config['TEMPLATES_AUTO_RELOAD'] = True
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0

# Load env BEFORE init_db (needs DATABASE_URL)
def _load_env_file(path):
    if os.path.exists(path):
        with open(path, 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    os.environ.setdefault(key, value)

_load_env_file(os.path.join(os.path.dirname(__file__), '.env'))

# Session secret key
app.secret_key = os.environ.get('FLASK_SECRET_KEY', 'dev-fallback-key')

# ---------------------------------------------------------------------------
# Startup
# ---------------------------------------------------------------------------
init_db()

DEFAULT_BANKROLL = 40000.0


# ---------------------------------------------------------------------------
# NCAA Market Types
# ---------------------------------------------------------------------------
MARKET_DISPLAY = {
    'win_title': 'Win Title',
    'reach_championship': 'Reach Championship',
    'reach_f4': 'Reach Final Four',
    'reach_e8': 'Reach Elite 8',
    'reach_s16': 'Reach Sweet 16',
    'reach_r32': 'Reach Round of 32',
    'game_ml': 'Game Moneyline',
    'game_spread': 'Game Spread',
    'game_total': 'Game Total',
    'other': 'Other',
}


# ---------------------------------------------------------------------------
# Auth Middleware (name-based, no passwords)
# ---------------------------------------------------------------------------
def _get_username():
    """Get current session username or None."""
    return session.get('username')


@app.before_request
def require_login():
    allowed = ('/login', '/set_username', '/static', '/favicon')
    if any(request.path.startswith(p) for p in allowed):
        return
    if 'username' not in session:
        return redirect(url_for('login'))


@app.route('/login', methods=['GET'])
def login():
    return render_template('login.html')


@app.route('/set_username', methods=['POST'])
def set_username():
    """Set session username (name-based, no password)."""
    # Try form data first (HTML form submission), then JSON (API call)
    username = (request.form.get('username') or '').strip().lower()

    if not username and request.is_json:
        data = request.json or {}
        username = (data.get('username') or '').strip().lower()

    if not username:
        if request.is_json:
            return jsonify({'success': False, 'error': 'name required'}), 400
        return render_template('login.html', error='name required')

    session['username'] = username

    # Initialize bankroll for new users
    existing = get_config(f'bankroll_{username}')
    if not existing:
        set_config(f'bankroll_{username}', str(DEFAULT_BANKROLL))

    if request.is_json:
        return jsonify({'success': True, 'username': username})
    return redirect(url_for('index'))


@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))


# ---------------------------------------------------------------------------
# Main Page
# ---------------------------------------------------------------------------
@app.route('/')
def index():
    return render_template('index.html', username=session.get('username', ''))


# ---------------------------------------------------------------------------
# Kelly Calculator
# ---------------------------------------------------------------------------
@app.route('/calculate-kelly', methods=['POST'])
def calculate_kelly_endpoint():
    """Calculate Kelly bet sizing for multiple book lines"""
    try:
        data = request.json

        fair_value = float(data['fair_value'])
        fair_format = data['fair_format']
        bankroll = float(data['bankroll'])
        kelly_fraction = float(data['kelly_fraction'])
        lines = data['lines']  # List of {book, price, format, fee}

        fair_decimal = convert_to_decimal(fair_value, fair_format)
        fair_american = convert_to_american(fair_value, fair_format)

        results = []
        for line in lines:
            book = line['book']
            price = float(line['price'])
            price_format = line['format']
            fee_pct = float(line.get('fee', 0))

            line_decimal = convert_to_decimal(price, price_format)

            # Adjust for fees if applicable
            if fee_pct > 0:
                fee_multiplier = 1 - (fee_pct / 100)
                adj_decimal = 1 + ((line_decimal - 1) * fee_multiplier)
            else:
                adj_decimal = line_decimal

            line_american = decimal_to_american(line_decimal)
            adj_american = decimal_to_american(adj_decimal)

            # Calculate edge: (book_odds / fair_odds) - 1
            edge = (adj_decimal / fair_decimal) - 1

            # Calculate Kelly bet size
            if edge > 0:
                win_prob = 1 / fair_decimal
                b = adj_decimal - 1
                kelly_fraction_full = (win_prob * b - (1 - win_prob)) / b
                if kelly_fraction_full <= 0:
                    kelly_bet = 0
                else:
                    kelly_bet = bankroll * kelly_fraction_full * kelly_fraction
            else:
                kelly_bet = 0

            results.append({
                'book': book,
                'price': price,
                'format': price_format,
                'adj_for_fees': adj_american if fee_pct > 0 else line_american,
                'american': line_american,
                'edge_pct': edge * 100,
                'kelly_bet': round(kelly_bet, 2)
            })

        # Sort by edge ascending (worst first, best last)
        results.sort(key=lambda x: x['edge_pct'], reverse=False)

        # Calculate cumulative column for ladder betting
        cumulative_total = 0
        for result in results:
            cumulative_total += result['kelly_bet']
            result['cumulative'] = round(cumulative_total, 2)

        return jsonify({
            'success': True,
            'fair_american': fair_american,
            'results': results
        })

    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


# ---------------------------------------------------------------------------
# Bankroll
# ---------------------------------------------------------------------------
@app.route('/get_bankroll', methods=['GET'])
def get_bankroll_route():
    """Get current bankroll value for session user."""
    try:
        username = _get_username()
        if not username:
            return jsonify({'success': False, 'error': 'not logged in'}), 401

        bankroll_val = get_bankroll(username)
        starting = get_config(f'starting_bankroll_{username}')
        starting_bankroll = float(starting) if starting else DEFAULT_BANKROLL

        return jsonify({
            'success': True,
            'bankroll': bankroll_val,
            'starting_bankroll': starting_bankroll,
            'username': username
        })

    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/set_bankroll', methods=['POST'])
def set_bankroll_route():
    """Set bankroll value for session user."""
    try:
        username = _get_username()
        if not username:
            return jsonify({'success': False, 'error': 'not logged in'}), 401

        data = request.json or {}
        val = data.get('bankroll')
        if val is None:
            return jsonify({'success': False, 'error': 'bankroll value required'}), 400

        set_config(f'bankroll_{username}', str(float(val)))

        return jsonify({
            'success': True,
            'bankroll': float(val)
        })

    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


# ---------------------------------------------------------------------------
# Bet Management
# ---------------------------------------------------------------------------
@app.route('/log_bet', methods=['POST'])
def log_bet_route():
    """Log a bet to the database."""
    try:
        username = _get_username()
        if not username:
            return jsonify({'success': False, 'error': 'not logged in'}), 401

        data = request.json
        print(f"log_bet received: {data}")

        # Handle position close first if close_data is provided
        close_results = []
        close_records = []
        total_shares_closed = 0
        original_close_shares = 0

        if 'close_data' in data and data['close_data']:
            close_data = data['close_data']
            close_price = close_data.get('close_price', 0)
            total_new_shares = float(data.get('total_shares_filled', 0))
            if total_new_shares <= 0:
                bid_price_raw = float(data.get('bid_price', 0))
                total_new_shares = float(data.get('actual_stake', 0)) / (bid_price_raw / 100.0) if bid_price_raw > 0 else close_data.get('close_shares', 0)
            original_close_shares = total_new_shares
            remaining_close_shares = total_new_shares

            # First close
            result = close_pm_position(close_data, data.get('bookie', ''), username)
            close_results.append(result)

            if result.get('success'):
                shares_closed = result.get('shares_closed', 0)
                total_shares_closed += shares_closed
                remaining_close_shares -= shares_closed
                close_records.append({
                    'shares_closed': shares_closed,
                    'close_price': close_price,
                    'closed_bet_id': result.get('bet_id'),
                    'book': data.get('bookie', ''),
                })

            # Cascading closes
            new_bet_side = data.get('side', 'NO')
            while remaining_close_shares > 0.01:
                opposite = find_opposite_position(
                    data['player_name'],
                    data['tournament_name'],
                    data['market_type'],
                    new_bet_side,
                    data.get('bookie', ''),
                    username
                )

                if not opposite or opposite['shares'] <= 0:
                    break

                shares_for_this_close = min(remaining_close_shares, opposite['shares'])
                cascade_close_data = {
                    'close_bet_id': opposite['bet_id'],
                    'close_shares': shares_for_this_close,
                    'close_price': close_price,
                    'existing_avg_price': opposite['avg_price'],
                }

                result = close_pm_position(cascade_close_data, data.get('bookie', ''), username)
                close_results.append(result)

                if result.get('success'):
                    shares_closed = result.get('shares_closed', 0)
                    total_shares_closed += shares_closed
                    remaining_close_shares -= shares_closed
                    close_records.append({
                        'shares_closed': shares_closed,
                        'close_price': close_price,
                        'closed_bet_id': opposite['bet_id'],
                        'book': data.get('bookie', ''),
                    })
                else:
                    break

        bet_data = {
            'tournament_name': data['tournament_name'],
            'market_type': data['market_type'],
            'player_name': data['player_name'],
            'bookie': data['bookie'],
            'fair_odds': float(data['fair_odds']),
            'book_odds': float(data['book_odds']),
            'edge_percent': float(data.get('edge_percent', 0)),
            'predicted_kelly': float(data.get('predicted_kelly', 0)),
            'actual_stake': float(data['actual_stake']),
            'username': username
        }

        # Add optional fields
        if 'bid_price' in data:
            bet_data['bid_price'] = float(data['bid_price'])
            calculated_odds = 100.0 / float(data['bid_price'])
            bet_data['book_odds'] = calculated_odds
        if 'filled_amount' in data:
            bet_data['filled_amount'] = float(data['filled_amount'])
        if 'notes' in data:
            bet_data['notes'] = str(data['notes'])
        if data.get('side'):
            bet_data['side'] = str(data['side'])

        # Adjust new bet size if cascading closes consumed some shares
        if total_shares_closed > 0 and original_close_shares > 0 and bet_data['actual_stake'] > 0:
            bid_price = float(data.get('bid_price', 0))
            if bid_price > 0:
                original_total_shares = bet_data['actual_stake'] / (bid_price / 100.0)
                remaining_shares = original_total_shares - total_shares_closed
                if remaining_shares > 0.01:
                    remaining_fraction = remaining_shares / original_total_shares
                    bet_data['actual_stake'] = round(bet_data['actual_stake'] * remaining_fraction, 2)
                    if 'filled_amount' in bet_data:
                        bet_data['filled_amount'] = round(bet_data['filled_amount'] * remaining_fraction, 2)
                else:
                    bet_data['actual_stake'] = 0

        # Log new bet
        bet_id = None
        log_id = None
        all_consumed = bet_data['actual_stake'] <= 0 and total_shares_closed > 0
        if all_consumed:
            bet_data['actual_stake'] = 0.01
            bet_data['filled_amount'] = 0.01
        if bet_data['actual_stake'] > 0:
            result = log_bet(bet_data)
            if result:
                bet_id = result['bet_id'] if isinstance(result, dict) else result
                log_id = result.get('log_id') if isinstance(result, dict) else None

        # Insert mirrored bet_logs on the new bet for each close
        if bet_id and close_records:
            from db import get_connection as _get_conn
            mir_conn = _get_conn()
            mir_cursor = mir_conn.cursor()
            is_pm = 1 if float(data.get('bid_price', 0)) > 0 else 0
            for cr in close_records:
                mirror_filled = cr['shares_closed'] * cr['close_price'] / 100
                mir_cursor.execute('''
                    INSERT INTO ncaa_bet_logs (
                        bet_id, timestamp, stake_added, filled_added, odds,
                        bid_price, fair_odds, edge_percent, bookie,
                        shares_bid, shares_filled,
                        is_prediction_market, is_finalized, notes, username
                    ) VALUES (%s, NOW(), %s, %s, %s, %s, 0, 0, %s, %s, %s, %s, 1, %s, %s)
                ''', (
                    bet_id,
                    mirror_filled,
                    mirror_filled,
                    100 / cr['close_price'] if cr['close_price'] > 0 else 0,
                    cr['close_price'],
                    cr['book'],
                    cr['shares_closed'],
                    cr['shares_closed'],
                    is_pm,
                    f"CLOSE MIRROR: {cr['shares_closed']:.0f} shares @ {cr['close_price']:.1f} (closed bet #{cr['closed_bet_id']})",
                    username
                ))
            _recalculate_bet_totals(mir_cursor, bet_id)
            mir_conn.commit()
            mir_conn.close()

        response = {
            'success': True,
            'bet_id': bet_id,
            'message': f'Bet #{bet_id} logged' if bet_id else 'position closed'
        }

        if len(close_results) == 1:
            response['close_result'] = close_results[0]
        elif len(close_results) > 1:
            response['close_result'] = close_results[0]
            response['close_results'] = close_results
            response['total_shares_closed'] = total_shares_closed

        return jsonify(response)

    except Exception as e:
        print(f"ERROR in log_bet: {e}")
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/get_active_bets', methods=['GET'])
def get_active_bets_route():
    """Get all active bets for session user."""
    try:
        username = _get_username()
        if not username:
            return jsonify({'success': False, 'error': 'not logged in'}), 401

        bets = get_active_bets(username, group_by_tournament=False)
        summary = get_bet_summary(username)

        if not isinstance(bets, list):
            bets = []

        return jsonify({
            'success': True,
            'bets': bets,
            'summary': summary,
            'pl_adjustments': get_pl_adjustments(username)
        })

    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/get_bet_logs/<int:bet_id>', methods=['GET'])
def get_bet_logs_route(bet_id):
    """Get all log entries for a bet, grouped by bookie."""
    try:
        from database import get_bet_logs
        bet, books = get_bet_logs(bet_id)

        return jsonify({
            'success': True,
            'bet': bet,
            'books': books
        })

    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/delete_bet/<int:bet_id>', methods=['DELETE'])
def delete_bet_route(bet_id):
    """Delete a bet and all its logs."""
    try:
        username = _get_username()
        if not username:
            return jsonify({'success': False, 'error': 'not logged in'}), 401

        from database import delete_bet
        delete_bet(bet_id, username)

        return jsonify({
            'success': True,
            'message': f'Bet #{bet_id} deleted'
        })

    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/delete_bet_log/<int:log_id>', methods=['DELETE'])
def delete_bet_log_route(log_id):
    """Delete a specific bet log entry and recalculate bet totals."""
    try:
        from database import delete_bet_log
        delete_bet_log(log_id)

        return jsonify({
            'success': True,
            'message': f'Bet log #{log_id} deleted'
        })

    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/grade_bet', methods=['POST'])
def grade_bet_route():
    """Grade a bet (Won/Lost/Push/Dead Heat) and update bankroll."""
    try:
        username = _get_username()
        if not username:
            return jsonify({'success': False, 'error': 'not logged in'}), 401

        data = request.json
        bet_id = data['bet_id']
        result = data['result']
        adjusted_odds = data.get('adjusted_odds')

        if adjusted_odds:
            adjusted_odds = float(adjusted_odds)

        grade_result = grade_bet(bet_id, result, username, adjusted_odds)

        return jsonify({
            'success': True,
            'bet_id': grade_result['bet_id'],
            'result': grade_result['result'],
            'profit_loss': grade_result['profit_loss'],
            'graded_at': grade_result['graded_at'],
            'new_bankroll': grade_result['new_bankroll']
        })

    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/ungrade_bet', methods=['POST'])
def ungrade_bet_route():
    """Ungrade a bet and reverse bankroll change."""
    try:
        username = _get_username()
        if not username:
            return jsonify({'success': False, 'error': 'not logged in'}), 401

        data = request.json
        bet_id = data['bet_id']

        ungrade_result = ungrade_bet(bet_id, username)

        return jsonify({
            'success': True,
            'bet_id': ungrade_result['bet_id'],
            'reversed_pl': ungrade_result['reversed_pl'],
            'new_bankroll': ungrade_result['new_bankroll']
        })

    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


# ---------------------------------------------------------------------------
# Events (shared across all users)
# ---------------------------------------------------------------------------
@app.route('/create_event', methods=['POST'])
def create_event_route():
    """Create a new event."""
    try:
        data = request.json
        event_id = create_event(
            data['event_name'],
            data.get('sport_category', 'NCAAB')
        )

        return jsonify({
            'success': True,
            'event_id': event_id
        })

    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/get_events', methods=['GET'])
def get_events_route():
    """Get all events, optionally filtered by sport category and archive status."""
    try:
        sport_category = request.args.get('sport_category', None)
        include_archived = request.args.get('include_archived', 'true').lower() == 'true'
        events = get_events(sport_category, include_archived)

        return jsonify({
            'success': True,
            'events': events
        })

    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/delete_event/<int:event_id>', methods=['DELETE'])
def delete_event_route(event_id):
    """Delete an event (only if it has no bets)."""
    try:
        delete_event(event_id)

        return jsonify({
            'success': True,
            'message': f'Event #{event_id} deleted'
        })

    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/archive_event/<int:event_id>', methods=['POST'])
def archive_event_route(event_id):
    """Archive an event."""
    try:
        event_name = archive_event(event_id)

        return jsonify({
            'success': True,
            'message': f'Event "{event_name}" archived'
        })

    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


# ---------------------------------------------------------------------------
# Position Close API
# ---------------------------------------------------------------------------
@app.route('/api/find_opposite_position', methods=['GET'])
def api_find_opposite_position():
    """Find opposite position for PM close detection."""
    username = _get_username()
    if not username:
        return jsonify({'exists': False})

    result = find_opposite_position(
        request.args.get('player_name', ''),
        request.args.get('tournament_name'),
        request.args.get('market_type'),
        request.args.get('side'),
        request.args.get('bookie'),
        username
    )
    if result:
        return jsonify({
            'exists': True,
            'bet_id': result['bet_id'],
            'shares': result['shares'],
            'avg_price': result['avg_price'],
            'side': result['side']
        })
    return jsonify({'exists': False})


# ---------------------------------------------------------------------------
# Debug
# ---------------------------------------------------------------------------
@app.route('/admin/db-status')
def db_status():
    """Debug endpoint to check Postgres DB state."""
    import re
    from db import get_connection, DATABASE_URL
    info = {}
    info['DATABASE_URL'] = re.sub(r'://[^:]+:[^@]+@', '://***:***@', DATABASE_URL)
    info['session_user'] = session.get('username', '(none)')
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'ncaa_%' ORDER BY table_name")
        tables = [row['table_name'] for row in cursor.fetchall()]
        info['TABLES'] = tables
        for table in tables:
            cursor.execute(f'SELECT COUNT(*) AS cnt FROM "{table}"')
            info[f'COUNT_{table}'] = cursor.fetchone()['cnt']
        conn.close()
    except Exception as e:
        info['DB_ERROR'] = str(e)
    return '<pre>' + '\n'.join(f'{k}: {v}' for k, v in info.items()) + '</pre>'


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5055, debug=True)
