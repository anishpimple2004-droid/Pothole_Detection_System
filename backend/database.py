import psycopg2
from config import DATABASE_URI

def get_db_connection():
    conn = psycopg2.connect(DATABASE_URI)
    conn.autocommit = True
    return conn
