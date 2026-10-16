#!/usr/bin/env bash
# Smoke test for the cart API. Needs the server running (npm run dev) and at
# least one product with stock >= 2 (npm run seed).
#   bash scripts/test-cart.sh
set -u
API=${API:-http://localhost:8000}
JAR=$(mktemp)
PASS=0; FAIL=0

check() { # name expected actual
  if [ "$2" = "$3" ]; then PASS=$((PASS+1)); echo "PASS  $1 ($3)"; else FAIL=$((FAIL+1)); echo "FAIL  $1 (expected $2, got $3)"; fi
}
req() { # method path [json] -> sets CODE and BODY
  BODY=$(curl -s -b "$JAR" -c "$JAR" -X "$1" "$API$2" -H "Content-Type: application/json" ${3:+-d "$3"} -w $'\n%{http_code}')
  CODE=${BODY##*$'\n'}; BODY=${BODY%$'\n'*}
}
qty() { node -e 'const c=JSON.parse(process.argv[1]).cart||[];const r=c.find(i=>i.product._id===process.argv[2]);console.log(c.length+":"+(r?r.quantity:0))' "$BODY" "$PID"; }

# Pick a product with stock >= 2.
read -r PID STOCK < <(curl -s "$API/products" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const p=JSON.parse(s).products.find(p=>p.stock>=2);console.log(p._id,p.stock)})')
echo "Using product $PID (stock $STOCK)"

req GET /cart;                                   check "10. Unauthorized request" 401 "$CODE"

EMAIL="cart$(date +%s)@test.com"
req POST /customers/register "{\"fullName\":\"Cart Tester\",\"email\":\"$EMAIL\",\"password\":\"secret123\",\"phone\":\"9876543210\"}"
req POST /customers/login "{\"email\":\"$EMAIL\",\"password\":\"secret123\"}"; check "    login" 200 "$CODE"

req POST "/cart/$PID";                           check "1. Add item" 201 "$CODE"; check "   1 row, qty 1" "1:1" "$(qty)"
req POST "/cart/$PID";                           check "2. Add same item again" 200 "$CODE"; check "   still 1 row, qty 2" "1:2" "$(qty)"
req GET /cart;                                   check "3. Get cart" 200 "$CODE"; check "   populated, qty 2" "1:2" "$(qty)"
req PATCH "/cart/$PID" '{"quantity":1}';         check "4. Update quantity" 200 "$CODE"; check "   qty 1" "1:1" "$(qty)"
req PATCH "/cart/$PID" "{\"quantity\":$((STOCK+1))}"; check "5. Quantity > stock" 400 "$CODE"
req PATCH "/cart/$PID" "{\"quantity\":$STOCK}";  req POST "/cart/$PID"; check "5b. Add beyond stock" 400 "$CODE"
req PATCH "/cart/$PID" '{"quantity":0}';         check "6. Quantity < 1" 400 "$CODE"
req PATCH "/cart/$PID" '{"quantity":"abc"}';     check "6b. Quantity not a number" 400 "$CODE"
req POST /cart/not-an-id;                        check "7. Invalid ObjectId (POST)" 400 "$CODE"
req PATCH /cart/123 '{"quantity":1}';            check "7b. Invalid ObjectId (PATCH)" 400 "$CODE"
req DELETE /cart/xyz;                            check "7c. Invalid ObjectId (DELETE)" 400 "$CODE"
req POST /cart/000000000000000000000000;         check "8. Product not found (POST)" 404 "$CODE"
req PATCH /cart/000000000000000000000000 '{"quantity":1}'; check "8b. Product not found (PATCH)" 404 "$CODE"
req DELETE "/cart/$PID";                         check "9. Remove item" 200 "$CODE"; check "   cart empty" "0:0" "$(qty)"
req PATCH "/cart/$PID" '{"quantity":1}';         check "9b. Update item not in cart" 404 "$CODE"

req POST /customers/logout
req GET /cart;                                   check "10b. Unauthorized after logout" 401 "$CODE"

rm -f "$JAR"
echo "---- $PASS passed, $FAIL failed"
[ "$FAIL" = 0 ]
