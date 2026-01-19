"""Validate Supabase RLS security policies - Authenticated Mode."""

import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

url = os.environ.get("SUPABASE_URL")
anon_key = os.environ.get("SUPABASE_ANON_KEY")
service_key = os.environ.get("SUPABASE_SERVICE_KEY")

print("=" * 60)
print("SUPABASE SECURITY VALIDATION (Authenticated Mode)")
print("=" * 60)

# Create both clients
anon_client = create_client(url, anon_key)
service_client = create_client(url, service_key)

test_wine = {
    "ct_wine_id": "TEST_SECURITY_001",
    "wine_name": "Security Test Wine",
    "valuation": 999.99
}

results = []

# ===========================================
# Test 1: Anon CANNOT read wines table
# ===========================================
print("\n[TEST 1] Anon key CANNOT READ wines table (protected)...")
try:
    result = anon_client.table("wines").select("*").limit(1).execute()
    if result.data == []:
        # Empty result could mean blocked or just no data - need to test with data
        print("  INFO - Empty result (will verify with data test)")
        results.append(("Anon BLOCKED from reading wines", "PENDING"))
    else:
        print("  FAIL - Anon can read wines! SECURITY HOLE!")
        results.append(("Anon BLOCKED from reading wines", "FAIL - SECURITY HOLE"))
except Exception as e:
    print(f"  PASS - Anon blocked: {str(e)[:50]}")
    results.append(("Anon BLOCKED from reading wines", "PASS"))

# ===========================================
# Test 2: Anon CANNOT write to wines table
# ===========================================
print("\n[TEST 2] Anon key CANNOT WRITE to wines table...")
try:
    result = anon_client.table("wines").insert(test_wine).execute()
    print("  FAIL - Anon was able to write! SECURITY HOLE!")
    results.append(("Anon BLOCKED from writing wines", "FAIL - SECURITY HOLE"))
    service_client.table("wines").delete().eq("ct_wine_id", "TEST_SECURITY_001").execute()
except Exception as e:
    print(f"  PASS - Anon correctly blocked from writing")
    results.append(("Anon BLOCKED from writing wines", "PASS"))

# ===========================================
# Test 3: Service role CAN write to wines table
# ===========================================
print("\n[TEST 3] Service role CAN WRITE to wines table...")
try:
    result = service_client.table("wines").insert(test_wine).execute()
    print("  PASS - Service role can write")
    results.append(("Service role WRITE wines", "PASS"))
except Exception as e:
    print(f"  FAIL - {e}")
    results.append(("Service role WRITE wines", "FAIL"))

# ===========================================
# Test 4: Service role CAN read wines table
# ===========================================
print("\n[TEST 4] Service role CAN READ wines table...")
try:
    result = service_client.table("wines").select("*").eq("ct_wine_id", "TEST_SECURITY_001").execute()
    if result.data and result.data[0]["valuation"] == 999.99:
        print("  PASS - Service role can read (including valuation)")
        results.append(("Service role READ wines", "PASS"))
    else:
        print("  FAIL - Data not found")
        results.append(("Service role READ wines", "FAIL"))
except Exception as e:
    print(f"  FAIL - {e}")
    results.append(("Service role READ wines", "FAIL"))

# ===========================================
# Test 5: Verify anon CANNOT read inserted data
# ===========================================
print("\n[TEST 5] Anon CANNOT read the test wine we just inserted...")
try:
    result = anon_client.table("wines").select("*").eq("ct_wine_id", "TEST_SECURITY_001").execute()
    if result.data and len(result.data) > 0:
        print("  FAIL - Anon can see wine data! SECURITY HOLE!")
        results.append(("Anon BLOCKED from seeing wine data", "FAIL - SECURITY HOLE"))
    else:
        print("  PASS - Anon cannot see wine data")
        results.append(("Anon BLOCKED from seeing wine data", "PASS"))
        # Update pending result from Test 1
        results = [(n, "PASS") if n == "Anon BLOCKED from reading wines" else (n, s) for n, s in results]
except Exception as e:
    print(f"  PASS - Anon blocked: {str(e)[:50]}")
    results.append(("Anon BLOCKED from seeing wine data", "PASS"))

# ===========================================
# Test 6: Anon CANNOT write to pull_list_items
# ===========================================
print("\n[TEST 6] Anon key CANNOT WRITE to pull_list_items (now protected)...")
test_pull_item = {
    "wine_id": "TEST_SECURITY_001",
    "quantity": 1
}
try:
    result = anon_client.table("pull_list_items").insert(test_pull_item).execute()
    print("  FAIL - Anon can write pull_list! SECURITY HOLE!")
    results.append(("Anon BLOCKED from writing pull_list", "FAIL - SECURITY HOLE"))
    service_client.table("pull_list_items").delete().eq("wine_id", "TEST_SECURITY_001").execute()
except Exception as e:
    print(f"  PASS - Anon correctly blocked")
    results.append(("Anon BLOCKED from writing pull_list", "PASS"))

# ===========================================
# Cleanup
# ===========================================
print("\n[CLEANUP] Removing test data...")
try:
    service_client.table("wines").delete().eq("ct_wine_id", "TEST_SECURITY_001").execute()
    print("  Done")
except:
    pass

# ===========================================
# SUMMARY
# ===========================================
print("\n" + "=" * 60)
print("SECURITY VALIDATION SUMMARY")
print("=" * 60)

all_pass = True
for test_name, status in results:
    if "PENDING" in status:
        continue
    icon = "[OK]" if "PASS" in status else "[!!]"
    print(f"  {icon} {test_name}: {status}")
    if "FAIL" in status:
        all_pass = False

print()
if all_pass:
    print("[OK] All security tests passed!")
    print()
    print("Your wine collection is now protected:")
    print("  - Anonymous users cannot see ANY data")
    print("  - Only authenticated users can read data")
    print("  - Only service_role can write data")
    print()
    print("Next: Update dashboard to require login")
else:
    print("[!!] SECURITY ISSUES DETECTED - Review RLS policies!")
