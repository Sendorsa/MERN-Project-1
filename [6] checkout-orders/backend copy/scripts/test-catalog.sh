#!/usr/bin/env bash
# Regression smoke test: auth, products (list/search/category/details) and
# wishlist. Needs the server running (npm run dev).
#   bash scripts/test-catalog.sh
set -u
API=${API:-http://localhost:8000}
JAR=$(mktemp)
PASS=0; FAIL=0
check() { if [ "$2" = "$3" ]; then PASS=$((PASS+1)); echo "PASS  $1 ($3)"; else FAIL=$((FAIL+1)); echo "FAIL  $1 (expected $2, got $3)"; fi; }
code() { curl -s -o /dev/null -w '%{http_code}' -b "$JAR" -c "$JAR" -H "Content-Type: application/json" "$@"; }
count() { curl -s -b "$JAR" "$@" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).count))'; }

EMAIL="catalog$(date +%s)@test.com"
# JSON bodies live in variables: inline inside "$(...)" bash brace-expands them.
REGISTER='{"fullName":"Catalog Tester","email":"'$EMAIL'","password":"secret123","phone":"9876543210"}'
BAD_LOGIN='{"email":"'$EMAIL'","password":"nope123"}'
LOGIN='{"email":"'$EMAIL'","password":"secret123"}'
check "register" 201 "$(code -X POST "$API/customers/register" -d "$REGISTER")"
check "login wrong password" 401 "$(code -X POST "$API/customers/login" -d "$BAD_LOGIN")"
check "me before login" 401 "$(code "$API/customers/me")"
check "login" 200 "$(code -X POST "$API/customers/login" -d "$LOGIN")"
check "me after login" 200 "$(code "$API/customers/me")"

TOTAL=$(count "$API/products")
read -r PID CATEGORY NAME < <(curl -s "$API/products" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const p=JSON.parse(s).products[0];console.log(p._id,encodeURIComponent(p.category),p.name.split(" ")[0])})')
check "list products" 200 "$(code "$API/products")"
check "search narrows results" true "$( [ "$(count "$API/products?search=$NAME")" -ge 1 ] && [ "$(count "$API/products?search=$NAME")" -le "$TOTAL" ] && echo true || echo false)"
check "search with no match" 0 "$(count "$API/products?search=zzzz-no-such-product")"
check "category filter" true "$( [ "$(count "$API/products?category=$CATEGORY")" -ge 1 ] && echo true || echo false)"
check "product details" 200 "$(code "$API/products/$PID")"
check "product invalid id" 400 "$(code "$API/products/abc")"
check "product not found" 404 "$(code "$API/products/000000000000000000000000")"

check "wishlist add" 200 "$(code -X POST "$API/wishlist/$PID")"
check "wishlist duplicate" 409 "$(code -X POST "$API/wishlist/$PID")"
check "wishlist get" 1 "$(count "$API/wishlist")"
check "wishlist remove" 200 "$(code -X DELETE "$API/wishlist/$PID")"
check "wishlist empty" 0 "$(count "$API/wishlist")"

check "logout" 200 "$(code -X POST "$API/customers/logout")"
check "wishlist after logout" 401 "$(code "$API/wishlist")"
rm -f "$JAR"
echo "---- $PASS passed, $FAIL failed"
[ "$FAIL" = 0 ]
