# ShopKart API

JWT + HttpOnly cookie authentication and a product catalog, built with Node.js, Express and MongoDB, following a strict MVC architecture.

## Folder Structure

```
backend/
├── controllers/
│   ├── customer.controller.js
│   └── product.controller.js
├── models/
│   ├── customer.model.js
│   └── product.model.js
├── routes/
│   ├── customer.routes.js
│   └── product.routes.js
├── middlewares/
│   └── auth.middleware.js
├── utils/
│   └── generateToken.js
├── config/
│   └── db.js
├── scripts/
│   └── seed.js
├── index.js
├── package.json
└── .env.example
```

## Installation

```bash
cd backend
npm install
cp .env.example .env
```

Install the dependencies explicitly (equivalent to the above):

```bash
npm install express mongoose bcrypt jsonwebtoken cookie-parser dotenv cors
npm install --save-dev nodemon
```

Then edit `.env` and set a real `JWT_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

## Running

```bash
npm run dev    # development, auto-restarts via node --watch
bash scripts/test-cart.sh   # cart API smoke test (server must be running)
node scripts/test-orders.js # orders/payment smoke test (server must be running)
npm start      # production
npm run seed   # insert/update 10 sample products (safe to re-run)
```

MongoDB must be reachable at `MONGODB_URI` before the server starts; the
process exits with an error if the connection fails.

## API

Base URL: `http://localhost:8000` (`PORT` in `.env`; defaults to 5000)

| Method | Endpoint              | Access  | Description                       |
| ------ | --------------------- | ------- | --------------------------------- |
| GET    | `/health`             | Public  | Service health check              |
| POST   | `/customers/register` | Public  | Register a new customer           |
| POST   | `/customers/login`    | Public  | Log in, receive auth cookie       |
| GET    | `/customers/me`       | Private | Authenticated customer's profile  |
| POST   | `/customers/logout`   | Public  | Clear the auth cookie             |
| POST   | `/products`           | Public  | Create a product                  |
| GET    | `/products`           | Public  | List products (`?search=`, `?category=`) |
| GET    | `/products/:id`       | Public  | Get one product                   |
| POST   | `/cart/:productId`    | Private | Add 1 unit (new row or quantity + 1) |
| GET    | `/cart`               | Private | Cart with populated products      |
| PATCH  | `/cart/:productId`    | Private | Set quantity, body `{ "quantity": 2 }` |
| DELETE | `/cart/:productId`    | Private | Remove the row (idempotent)       |
| POST   | `/orders/create-payment-order` | Private | Cart → PENDING order + Razorpay order |
| POST   | `/orders/verify-payment` | Private | Check signature, mark PAID/PLACED, clear cart |
| GET    | `/orders`             | Private | My orders, newest first           |
| GET    | `/orders/:id`         | Private | One of my orders (others → 404)   |

### POST /customers/register

```json
{
  "fullName": "Athish R",
  "email": "athish@example.com",
  "password": "secret123",
  "phone": "9876543210"
}
```

All four fields must be non-empty **strings**. `password` must be at least 6
characters; `phone` must be 10-15 digits, optionally prefixed with `+`.

`201 Created`

```json
{
  "success": true,
  "message": "Customer registered successfully",
  "customer": {
    "_id": "...",
    "fullName": "Athish R",
    "email": "athish@example.com",
    "phone": "9876543210",
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

### POST /customers/login

```json
{ "email": "athish@example.com", "password": "secret123" }
```

`200 OK` and sets the `token` cookie with `HttpOnly; SameSite=Strict; Max-Age=604800`
(`Secure` is added when `NODE_ENV=production`).

### GET /customers/me

Requires the `token` cookie. Returns the customer without the password.

### POST /customers/logout

Public and idempotent. Always clears the `token` cookie and returns `200 OK`,
whether the caller sent a valid cookie, an expired one, or none at all.

### POST /products

```json
{
  "name": "Mechanical Keyboard",
  "description": "RGB mechanical keyboard with blue switches.",
  "price": 2999,
  "category": "Electronics",
  "image": "https://example.com/keyboard.jpg",
  "stock": 10
}
```

All fields are required. `name`, `description`, `category` and `image` must be
non-empty text, `image` an http(s) URL, `price` a number greater than 0 and
`stock` a whole number >= 0. Anything else is a `400`. Success is
`201 Created` with `{ "success": true, "product": { ... } }`; `createdAt` and
`updatedAt` are added automatically.

### GET /products

Returns `{ "success": true, "count": 3, "products": [ ... ] }`, newest first.
Both query parameters are optional and combine:

| Query | Behaviour |
| ----- | --------- |
| `search=keyboard` | Name contains the text, case-insensitive (`KEYB` matches "Mechanical Keyboard") |
| `category=Electronics` | Exact category, case-insensitive |
| `search=keyboard&category=Electronics` | Both conditions must hold |

The filter object is built from whichever parameters are present, so one
endpoint serves every combination. User input is regex-escaped, so it is always
matched literally.

### GET /products/:id

`200` with `{ "success": true, "product": { ... } }`, `400` if the id is not a
valid MongoDB ObjectId, `404` if no product has that id.

### Cart

Every cart endpoint responds with the whole cart:
`{ "success": true, "message": "...", "count": 1, "cart": [{ "product": { ... }, "quantity": 2 }] }`.

- `400` invalid ObjectId, quantity not a whole number, quantity < 1, quantity
  above stock, or product out of stock.
- `401` no/invalid auth cookie.
- `404` product does not exist, or (PATCH) product is not in the cart.

Adding a product already in the cart increments its quantity instead of
creating a second row; the stock check and increment run as one atomic update.

### Orders and Razorpay (test mode)

Needs `RAZORPAY_KEY_ID` (must start with `rzp_test_`) and `RAZORPAY_KEY_SECRET`
in `.env`. Without them the payment endpoints answer `503`; the rest of the
API still runs.

1. `POST /orders/create-payment-order` with `{ "shippingAddress": { fullName,
   phone, address, city, state, pincode } }`. Prices come from the database.
   Creates a `PENDING` order and a Razorpay order, returns
   `{ orderId, razorpayOrderId, amount (paise), currency, keyId }`.
   The cart is **not** cleared here.
2. The frontend opens Razorpay Checkout with that `razorpayOrderId`.
3. `POST /orders/verify-payment` with `{ orderId, razorpay_order_id,
   razorpay_payment_id, razorpay_signature }`. The server recomputes
   `HMAC_SHA256(razorpay_order_id + "|" + razorpay_payment_id, KEY_SECRET)`.
   Mismatch → `400`. Match → order `PAID` / `PLACED`, payment id saved,
   **then** the cart is cleared.

## Status Codes

| Code | Meaning                                                     |
| ---- | ----------------------------------------------------------- |
| 200  | Success                                                     |
| 201  | Customer created                                            |
| 400  | Validation error - missing/non-string field, short password, bad phone or email, malformed JSON |
| 401  | Invalid credentials, or missing/invalid/expired token       |
| 404  | Route not found, or product id not found                    |
| 409  | Email already registered                                    |
| 500  | Server error                                                |

## Design Notes

- **Password hashing** lives in a `pre("save")` hook on the model, so a
  password can never reach the database unhashed regardless of which
  controller writes it. Salt rounds: 10.
- **`password` is `select: false`** on the schema, so it is excluded from
  every query by default. Login re-selects it with `.select("+password")`,
  and a `toJSON` transform strips it as a second line of defence.
- **Login failures return one message** ("Invalid email or password") for
  both unknown email and wrong password, so the API does not reveal which
  accounts exist.
- **The auth middleware re-reads the customer** from the database on each
  request, so a deleted account cannot keep using a valid token.
- **Every field is type-checked** before use. A body such as
  `{"email": {"$ne": null}}` is rejected with 400 rather than reaching a Mongo
  query or crashing on `email.toLowerCase()`.
- **Errors** are handled locally where the status code is meaningful
  (400/401/409) and passed to the centralised handler in `index.js`
  otherwise. That handler logs the full stack server-side but returns a
  generic `"Internal server error"` for any 5xx, so internal details never
  reach the client.
- **Logout is public** on purpose. Behind the auth middleware, a customer
  holding an expired token would get a 401 and keep the stale cookie forever -
  the exact situation logout exists to resolve.
- **The auth cookie's `maxAge` is read from the issued token's own `iat`/`exp`
  claims**, so changing `JWT_EXPIRES_IN` moves both the token and the cookie
  together and they can never drift apart.
- **`secure` is evaluated per request**, not at module load, so it cannot
  silently resolve to `false` if the require order ever changes.

## Quick Test with curl

```bash
# Register
curl -i -X POST http://localhost:8000/customers/register \
  -H "Content-Type: application/json" \
  -d '{"fullName":"Athish R","email":"athish@example.com","password":"secret123","phone":"9876543210"}'

# Login - store the cookie
curl -i -X POST http://localhost:8000/customers/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"email":"athish@example.com","password":"secret123"}'

# Profile - send the cookie
curl -i http://localhost:8000/customers/me -b cookies.txt

# Logout
curl -i -X POST http://localhost:8000/customers/logout -b cookies.txt

# Create a product
curl -i -X POST http://localhost:8000/products \
  -H "Content-Type: application/json" \
  -d '{"name":"Mechanical Keyboard","description":"RGB mechanical keyboard with blue switches.","price":2999,"category":"Electronics","image":"https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&q=80&auto=format&fit=crop","stock":10}'

# List, search, filter, combine
curl "http://localhost:8000/products"
curl "http://localhost:8000/products?search=keyboard"
curl "http://localhost:8000/products?category=Electronics"
curl "http://localhost:8000/products?search=keyboard&category=Electronics"

# Single product (replace <id> with an _id from the list)
curl -i "http://localhost:8000/products/<id>"
curl -i "http://localhost:8000/products/abc"                        # 400 invalid id
curl -i "http://localhost:8000/products/000000000000000000000000"   # 404 not found

# Validation failures (400)
curl -i -X POST http://localhost:8000/products -H "Content-Type: application/json" -d '{"name":"X"}'
curl -i -X POST http://localhost:8000/products -H "Content-Type: application/json" \
  -d '{"name":"X","description":"d","price":0,"category":"Books","image":"https://example.com/x.jpg","stock":1}'
curl -i -X POST http://localhost:8000/products -H "Content-Type: application/json" \
  -d '{"name":"X","description":"d","price":10,"category":"Books","image":"https://example.com/x.jpg","stock":-1}'
```

## Beyond the Lab Scope

These are deliberately **not** implemented, because they fall outside the
specified stack (Express, Mongoose, bcrypt, jsonwebtoken, cookie-parser,
dotenv, cors). They are listed here because they are the first things a reviewer
will ask about.

| Concern | Why it is not here | What production would add |
| --- | --- | --- |
| **Login rate limiting** | Needs a dependency outside the stack. | `express-rate-limit` on `/customers/login`, e.g. 5 attempts per 15 min per IP, to blunt credential stuffing. |
| **Refresh tokens** | Brief specified a single 7-day JWT. | A short-lived (15 min) access token plus a rotating refresh token, so a stolen token has a small blast radius. |
| **Token revocation** | Stateless JWTs cannot be un-issued. | A denylist in Redis keyed by `jti`, checked in the auth middleware. Partially mitigated today: the middleware re-reads the customer from MongoDB on every request, so a deleted account is locked out immediately. |
| **Security headers** | Outside the stack. | `helmet()` for HSTS, `X-Content-Type-Options`, and friends. |
| **Password reset / email verification** | Not in the brief. | Single-use, time-limited, hashed tokens delivered by email. |

### Why HttpOnly cookies instead of `localStorage`

JavaScript cannot read an `HttpOnly` cookie, so an XSS payload cannot steal the
token. The trade-off is CSRF exposure, which `SameSite=Strict` addresses here:
the browser will not attach the cookie to any cross-site request.
