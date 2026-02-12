# install_deps.py
import subprocess
import sys

def install_package(package):
    """Install a Python package"""
    try:
        print(f"Installing {package}...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", package])
        print(f"✓ {package} installed successfully\n")
        return True
    except subprocess.CalledProcessError as e:
        print(f"✗ Failed to install {package}: {e}\n")
        return False

def main():
    print("=" * 50)
    print("Installing Python Dependencies")
    print("=" * 50)
    
    packages = [
        "earthengine-api",
        "psycopg2-binary",  # Already installed, but keeping for completeness
        "requests",
        "urllib3"
    ]
    
    success_count = 0
    for package in packages:
        if install_package(package):
            success_count += 1
    
    print("=" * 50)
    print(f"Installation complete: {success_count}/{len(packages)} packages installed")
    print("\nNext steps:")
    print("1. Run: python -c \"import ee; ee.Authenticate()\"")
    print("2. Then run your degradation_analysis.py script")
    print("=" * 50)

if __name__ == "__main__":
    main()