"""
Postgres connection helper.
Uses DATABASE_URL env var. All connections use psycopg2 with RealDictCursor by default.
"""
import os
import psycopg2
from psycopg2.extras import RealDictCursor

def _get_database_url():
    return os.environ.get('DATABASE_URL', '')

# Keep module-level for backwards compat (debug endpoint reads it)
DATABASE_URL = None


def get_connection(dict_cursor=True):
    """Get a Postgres connection. Returns connection object.
    Caller is responsible for conn.close().
    If dict_cursor=True (default), rows are returned as dicts."""
    global DATABASE_URL
    DATABASE_URL = _get_database_url()
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = False
    if dict_cursor:
        conn.cursor_factory = RealDictCursor
    return conn


def get_cursor(conn):
    """Get a cursor from a connection."""
    return conn.cursor()
