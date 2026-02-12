# check_auth.py
import ee
import os
import json

# Check for credentials file
credentials_path = os.path.expanduser('~/.config/earthengine/credentials')
if os.path.exists(credentials_path):
    print(f"✅ Credentials file found at: {credentials_path}")
    try:
        with open(credentials_path, 'r') as f:
            creds = json.load(f)
        print(f"   Contains keys: {list(creds.keys())}")
    except:
        print("   Could not read credentials file")
else:
    print(f"❌ No credentials file found at: {credentials_path}")

# Try to initialize
try:
    ee.Initialize(project='giz-gujarat')
    print("✅ Earth Engine initialized successfully!")
except Exception as e:
    print(f"❌ Initialization failed: {e}")
    print("\nYou need to authenticate first.")