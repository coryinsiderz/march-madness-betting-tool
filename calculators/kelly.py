"""
Kelly Criterion calculator for NCAA betting.
"""


def kelly_criterion(win_prob, decimal_odds, fraction=0.25):
    """
    Calculate Kelly bet size.

    Args:
        win_prob: Probability of winning (0-1)
        decimal_odds: Decimal odds (e.g., 5.0)
        fraction: Kelly fraction to use (default 0.25 = quarter Kelly)

    Returns:
        Fraction of bankroll to bet (0-1)
    """
    if win_prob <= 0 or win_prob >= 1 or decimal_odds <= 1:
        return 0

    b = decimal_odds - 1  # Net odds
    q = 1 - win_prob

    kelly_full = (win_prob * b - q) / b

    if kelly_full <= 0:
        return 0

    return kelly_full * fraction


def calculate_kelly_bet(bankroll, win_prob, decimal_odds, fraction=0.25):
    """
    Calculate Kelly bet size in dollars.

    Args:
        bankroll: Current bankroll
        win_prob: Probability of winning (0-1)
        decimal_odds: Decimal odds
        fraction: Kelly fraction (default 0.25)

    Returns:
        Dollar amount to bet
    """
    kelly_frac = kelly_criterion(win_prob, decimal_odds, fraction)
    return round(bankroll * kelly_frac, 2)
