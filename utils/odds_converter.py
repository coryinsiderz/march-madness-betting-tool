def decimal_to_american(decimal_odds):
    if decimal_odds >= 2.0:
        return round((decimal_odds - 1) * 100, 1)
    else:
        return round(-100 / (decimal_odds - 1), 1)


def american_to_decimal(american_odds):
    if american_odds > 0:
        return round((american_odds / 100) + 1, 3)
    else:
        return round((100 / abs(american_odds)) + 1, 3)


def percentage_to_decimal(percentage):
    """Convert percentage (e.g., 19.3 for 19.3%) to decimal odds"""
    return round(100 / percentage, 3)


def decimal_to_percentage(decimal_odds):
    """Convert decimal odds to percentage"""
    return round(100 / decimal_odds, 3)


def percentage_to_american(percentage):
    """Convert percentage directly to American odds"""
    decimal = percentage_to_decimal(percentage)
    return decimal_to_american(decimal)


def american_to_percentage(american_odds):
    """Convert American odds to percentage"""
    decimal = american_to_decimal(american_odds)
    return decimal_to_percentage(decimal)


def convert_to_decimal(value, format_type):
    """
    Convert any odds format to decimal.

    Args:
        value: The odds value (numeric)
        format_type: 'american', 'decimal', or 'percentage'

    Returns:
        Decimal odds
    """
    if format_type == 'decimal':
        return float(value)
    elif format_type == 'american':
        return american_to_decimal(float(value))
    elif format_type == 'percentage':
        return percentage_to_decimal(float(value))
    else:
        raise ValueError(f"Unknown format type: {format_type}")


def convert_to_american(value, format_type):
    """
    Convert any odds format to American.

    Args:
        value: The odds value (numeric)
        format_type: 'american', 'decimal', or 'percentage'

    Returns:
        American odds
    """
    if format_type == 'american':
        return float(value)
    elif format_type == 'decimal':
        return decimal_to_american(float(value))
    elif format_type == 'percentage':
        return percentage_to_american(float(value))
    else:
        raise ValueError(f"Unknown format type: {format_type}")
