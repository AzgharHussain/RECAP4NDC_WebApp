# test_db.py
import psycopg2
import sys

print("=" * 60)
print("DATABASE CONNECTION TEST")
print("=" * 60)

DB_CONFIG = {
    "host": "68.178.167.216",
    "database": "Recap4NDC_Query",  # ← CORRECT
    "user": "postgres",
    "password": "pass@123",         # ← CORRECT
    "port": 5435                     # ← CORRECT
}

try:
    print("Connecting to database...")
    conn = psycopg2.connect(**DB_CONFIG)
    cursor = conn.cursor()
    
    # Test PostgreSQL version
    cursor.execute("SELECT version();")
    db_version = cursor.fetchone()[0]
    print(f"✓ Connected to PostgreSQL")
    print(f"  Version: {db_version.split(',')[0]}")
    
    # Check coupe_village_master table
    cursor.execute("""
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'coupe_village_master'
        )
    """)
    
    if cursor.fetchone()[0]:
        cursor.execute("SELECT COUNT(*) FROM public.coupe_village_master;")
        count = cursor.fetchone()[0]
        print(f"✓ Found 'coupe_village_master' table")
        print(f"  Total records: {count}")
        
        # Get sample coupes
        cursor.execute("SELECT coupe_name FROM public.coupe_village_master LIMIT 5;")
        coupes = cursor.fetchall()
        if coupes:
            print(f"  Sample coupes:")
            for i, (coupe,) in enumerate(coupes, 1):
                print(f"    {i}. {coupe}")
    else:
        print("✗ 'coupe_village_master' table not found")
    
    # Check for existing coupe tables
    cursor.execute("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name LIKE '%NDVI_Change%'
        LIMIT 3
    """)
    existing_tables = cursor.fetchall()
    if existing_tables:
        print(f"\n✓ Found existing NDVI change tables:")
        for table in existing_tables:
            print(f"  - {table[0]}")
    
    cursor.close()
    conn.close()
    
    print("\n" + "=" * 60)
    print("DATABASE TEST: SUCCESS!")
    print("=" * 60)
    
except psycopg2.OperationalError as e:
    print(f"\n✗ Connection failed: {e}")
    print("\nPossible issues:")
    print("1. Database server (68.178.167.216:5435) is not accessible")
    print("2. Network/firewall blocking connection")
    print("3. Incorrect credentials")
    
except Exception as e:
    print(f"\n✗ Error: {e}")
    import traceback
    traceback.print_exc()

print("\nPress Enter to exit...")
input()