# test_connection.py
from database import get_db_connection

def test_db():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users")
        rows = cursor.fetchall()
        print("✅ Database connection successful.")
        print("Sample Users:")
        for row in rows:
            print(row)
        cursor.close()
        conn.close()
    except Exception as e:
        print("❌ Error:", e)

if __name__ == "__main__":
    test_db()
