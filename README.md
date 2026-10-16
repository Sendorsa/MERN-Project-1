# ShopKart: MERN E-Commerce Lab Project

ShopKart is a full-stack e-commerce web application built with MongoDB, Express, React and Node.js. Customers can register, sign in, browse and search a product catalog, keep a wishlist, manage a cart and check out with **Razorpay in test mode**. Stock is deducted only after the payment signature is verified.

The project was built in six incremental lab stages. Each stage is a self-contained snapshot. **Stage `[6] checkout-orders` is the complete, final application** and is the one to run and evaluate.

---

## Table of Contents

1. [Features](#1-features)
2. [Technology Stack](#2-technology-stack)
3. [Architecture](#3-architecture)
4. [Repository Structure](#4-repository-structure)
5. [Prerequisites](#5-prerequisites)
6. [Installation](#6-installation)
7. [Environment Variables](#7-environment-variables)
8. [Database Setup](#8-database-setup)
9. [Running the Application](#9-running-the-application)
10. [npm Scripts](#10-npm-scripts)
11. [API Reference](#11-api-reference)
12. [Authentication and Authorization](#12-authentication-and-authorization)
13. [Seed Data](#13-seed-data)
14. [Testing](#14-testing)
15. [Troubleshooting](#15-troubleshooting)
16. [Security Notes](#16-security-notes)
17. [Deployment](#17-deployment)
18. [Known Limitations](#18-known-limitations)

---

## 1. Features

All of these are implemented in stage `[6] checkout-orders`.

**Customer accounts**
- Register with full name, email, password (min. 6 characters) and phone number.
- Log in and log out. The session is a JWT stored in an `HttpOnly` cookie.
- Passwords are hashed with bcrypt and never returned by the API.

**Product catalog**
- Product list with case-insensitive name search and a category filter (Electronics, Fashion, Books, Home).
- Product details page with a stock badge.
- Seed script with 10 sample products.

**Wishlist**: add, view and remove products. Each customer has their own list.

**Cart** (stored in MongoDB, mirrored in Redux Toolkit on the client)
- Adding a product that is already in the cart increments its quantity.
- Quantity updates are checked against available stock.

**Checkout and orders**
- A shipping address form (6-digit pincode, 10–15 digit phone).
- Razorpay Checkout (test mode only; live keys are rejected by the server).
- Server-side HMAC-SHA256 payment signature verification.
- Stock is deducted atomically after verification, so it can never go negative and two buyers cannot both buy the last unit. MongoDB transactions are used when the server supports them.
- If stock runs out between payment and verification, the order is cancelled and the payment is refunded automatically.
- Order history and an order details page.

---

## 2. Technology Stack

| Layer | Technology (version from `package.json`) |
| --- | --- |
| Frontend | React 19, Vite 8, React Router 7, Redux Toolkit 2 + React Redux 9, Axios 1, Tailwind CSS 4 |
| Backend | Node.js, Express 4, Mongoose 8, jsonwebtoken 9, bcrypt 6, cookie-parser, cors, dotenv 16 |
| Database | MongoDB (MongoDB Atlas or a local `mongod`) |
| Payments | Razorpay Node SDK 2 (server) + Razorpay `checkout.js` (browser), test mode |
| Tooling | ESLint 10 (frontend), Node's built-in test runner (backend) |

---

## 3. Architecture

```
 Browser (React SPA, Vite dev server :5173)
   │  Axios, withCredentials: true  →  sends the HttpOnly "token" cookie
   ▼
 Express API (:8000)
   cors({ origin: CLIENT_URL, credentials: true })
   routes/  →  middlewares/auth.middleware.js (protect)  →  controllers/
   │                                                     │
   ▼                                                     ▼
 MongoDB via Mongoose                              Razorpay API
 (customers, products, orders)                     (create order, refund)
```

- **Backend**: MVC layout. `routes/` map URLs to `controllers/`, `models/` define Mongoose schemas, `middlewares/auth.middleware.js` guards private routes and `config/` holds the DB and Razorpay clients.
- **Frontend**: the React app calls the API directly (CORS with credentials). Signed-in pages sit under a single `ProtectedRoute` layout route, which checks `GET /customers/me` and loads the cart into Redux.
- **MongoDB collections** (from the Mongoose models): `customers` (with embedded `wishlist` and `cart` arrays), `products` and `orders`.

---

## 4. Repository Structure

```
.
├── README.md                     ← this file
├── .gitignore                    ← root ignore rules (env files, node_modules, dist, …)
├── [1] backend/                  Stage 1: authentication API only
├── [2] front end/                Stage 2: React login/register UI for stage 1
├── [3] product catelog/          Stage 3: + product catalog, search, filter
│   ├── backend copy/
│   └── front end copy/
├── [4] wishlist/                 Stage 4: + wishlist
├── [5] cart/                     Stage 5: + cart (Redux Toolkit)
└── [6] checkout-orders/          Stage 6: FINAL APP: + checkout, Razorpay, orders
    ├── backend copy/
    │   ├── config/               db.js, razorpay.js
    │   ├── controllers/          customer, product, wishlist, cart, order
    │   ├── middlewares/          auth.middleware.js
    │   ├── models/               customer, product, order
    │   ├── routes/               one router per resource
    │   ├── scripts/              seed.js, test-catalog.sh, test-cart.sh, test-orders.js
    │   ├── tests/                inventory.test.js
    │   ├── utils/                generateToken.js
    │   ├── index.js              Express app entry point
    │   ├── .env.example          backend environment template
    │   └── README.md             detailed API request/response examples
    └── front end copy/
        ├── src/
        │   ├── components/       Navbar, ProductCard, ProtectedRoute, …
        │   ├── pages/            Home, Products, ProductDetails, Wishlist, Cart,
        │   │                     Checkout, Orders, OrderDetails, Login, Register
        │   ├── services/api.js   Axios client + every API call
        │   ├── store/            Redux store and cartSlice
        │   ├── constants/        product categories
        │   └── utils/            formatting helpers
        ├── .env.example          optional frontend environment template
        ├── vite.config.js
        └── eslint.config.js
```

> Folder names contain spaces and square brackets, so **always quote them** in the terminal, e.g. `cd "[6] checkout-orders/backend copy"`.

Stages 1–5 run the same way as stage 6 (`npm install`, copy `.env.example` to `.env`, `npm run dev`). Stage 1 needs only `PORT`, `NODE_ENV`, `MONGODB_URI`, `JWT_SECRET` and `JWT_EXPIRES_IN`. Stage 2 proxies `/customers` to `http://localhost:8000` through Vite instead of using CORS.

---

## 5. Prerequisites

| Software | Version | Why |
| --- | --- | --- |
| Node.js | **20.19+ or 22.13+** (verified on 25.9.0) | Vite 8 and ESLint 10 require `^20.19.0 \|\| >=22.12.0` / `^22.13.0`; bcrypt requires ≥ 18 |
| npm | Comes with Node (verified on 11.12.1) | Installs from the committed `package-lock.json` files |
| MongoDB | MongoDB Atlas (free tier) **or** a local MongoDB server | Data storage |
| Razorpay account | Test mode | Only needed for checkout; the rest of the app runs without it |
| Git | Any recent version | Cloning |

---

## 6. Installation

```bash
git clone git@github.com:<your-username>/MERN-Project-1.git
cd MERN-Project-1

# Backend
cd "[6] checkout-orders/backend copy"
npm install
cp .env.example .env          # then edit .env (see section 7)

# Frontend (from the repository root)
cd "../front end copy"
npm install
```

`npm ci` can be used instead of `npm install` for an exact install from the lockfiles.

---

## 7. Environment Variables

### Backend: `[6] checkout-orders/backend copy/.env`

Create it with `cp .env.example .env`. `.env` is git-ignored and must never be committed.

| Variable | Required? | Example / placeholder | Purpose |
| --- | --- | --- | --- |
| `MONGODB_URI` | **Required** | `mongodb://127.0.0.1:27017/shopkart` or `mongodb+srv://<user>:<password>@<cluster>.mongodb.net/shopkart` | MongoDB connection string. The server exits on startup if missing. |
| `JWT_SECRET` | **Required** | `replace_this_with_a_long_random_secret` | Signs login tokens. Login fails without it. Generate one with `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `PORT` | Optional (code default `5000`) | `8000` | API port. **Use `8000`**: the frontend calls `http://localhost:8000` by default, and macOS uses 5000 for AirPlay Receiver. |
| `NODE_ENV` | Optional | `development` | `production` adds the `Secure` flag to the auth cookie (HTTPS only). |
| `JWT_EXPIRES_IN` | Optional (default `7d`) | `7d` | Token and cookie lifetime. |
| `CLIENT_URL` | Optional (default `http://localhost:5173`) | `http://localhost:5173` | Frontend origin allowed by CORS. |
| `RAZORPAY_KEY_ID` | Needed for checkout | `rzp_test_xxxxxxxxxxxxxx` | Razorpay **test** key id. Must start with `rzp_test_`. |
| `RAZORPAY_KEY_SECRET` | Needed for checkout | `replace_with_test_key_secret` | Razorpay test key secret. Used for order creation, signature verification and refunds. |
| `MONGODB_TRANSACTIONS` | Optional | `off` | Forces the non-transaction stock path. Normally left unset. |

Without the two Razorpay variables the API still starts; only `POST /orders/create-payment-order` answers `503 Payments are not configured on the server`.

### Frontend: `[6] checkout-orders/front end copy/.env.local` (optional)

| Variable | Required? | Default | Purpose |
| --- | --- | --- | --- |
| `VITE_API_URL` | Optional | `http://localhost:8000` | Backend base URL. Set it only if the API runs elsewhere. |

```bash
cd "[6] checkout-orders/front end copy"
cp .env.example .env.local     # only if you need a different API URL
```

> **Frontend variables are public.** Anything prefixed `VITE_` is compiled into the JavaScript bundle and visible to every visitor. Never put `JWT_SECRET`, `MONGODB_URI` or `RAZORPAY_KEY_SECRET` in the frontend. The Razorpay **key id** is public by design; the server returns it from `create-payment-order` for Razorpay Checkout.

---

## 8. Database Setup

You need **one** of the following.

**Option A: MongoDB Atlas (recommended)**
1. Create a free cluster at <https://cloud.mongodb.com>.
2. *Database Access* → add a database user with a strong password.
3. *Network Access* → add your current IP address.
4. *Connect → Drivers* → copy the `mongodb+srv://…` string, insert the user and password, and add `/shopkart` as the database name before the `?`.
5. Put it in `MONGODB_URI` in the backend `.env`.

Atlas clusters are replica sets, so stock deduction runs inside a MongoDB transaction.

**Option B: local MongoDB**
Install MongoDB Community Server, start it, and keep the template value `MONGODB_URI=mongodb://127.0.0.1:27017/shopkart`. A standalone local server has no transactions. The app detects this and falls back to atomic per-product updates with compensation (see [Known Limitations](#18-known-limitations)).

Collections are created automatically by Mongoose on first write; no migration step is needed.

---

## 9. Running the Application

Use two terminals.

**Terminal 1: backend**
```bash
cd "[6] checkout-orders/backend copy"
npm run seed     # first time only: loads 10 sample products
npm run dev      # http://localhost:8000 (auto-restarts on file changes)
```
Expected output:
```
[db] MongoDB connected: <host>
[server] Listening on http://localhost:8000
```
Check it with: `curl http://localhost:8000/health` → `{"success":true,"message":"ShopKart API is running"}`

**Terminal 2: frontend**
```bash
cd "[6] checkout-orders/front end copy"
npm run dev      # http://localhost:5173
```

Open <http://localhost:5173>, register an account, sign in and browse the products.

**Both together:** there is no single combined start script; run the two commands above in separate terminals.

**Test payment:** with Razorpay test keys configured, use the test card or UPI details from Razorpay's [test documentation](https://razorpay.com/docs/payments/payments/test-card-details/). No real money is charged in test mode.

---

## 10. npm Scripts

**Backend** (`[6] checkout-orders/backend copy`)

| Script | Command | Purpose |
| --- | --- | --- |
| `npm start` | `node index.js` | Start the API |
| `npm run dev` | `node --watch index.js` | Start with auto-restart on changes |
| `npm run seed` | `node scripts/seed.js` | Upsert 10 sample products (safe to re-run) |
| `npm test` | `node --test "tests/**/*.test.js"` | Stock-deduction tests (see section 14) |

**Frontend** (`[6] checkout-orders/front end copy`)

| Script | Command | Purpose |
| --- | --- | --- |
| `npm run dev` | `vite` | Dev server on port 5173 |
| `npm run build` | `vite build` | Production build into `dist/` |
| `npm run preview` | `vite preview` | Serve the built `dist/` locally |
| `npm run lint` | `eslint .` | Lint the source |

---

## 11. API Reference

Base URL: `http://localhost:8000`. All bodies are JSON. **Private** routes require the `token` cookie set by login; without it they return `401 Unauthorized`.

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/health` | Public | Health check |
| POST | `/customers/register` | Public | Register `{ fullName, email, password, phone }` |
| POST | `/customers/login` | Public | Log in `{ email, password }`; sets the auth cookie |
| POST | `/customers/logout` | Public | Clear the auth cookie (idempotent) |
| GET | `/customers/me` | Private | Current customer's profile |
| GET | `/products` | Public | List products; optional `?search=` and `?category=` |
| GET | `/products/:id` | Public | One product |
| POST | `/products` | Public ⚠️ | Create a product `{ name, description, price, category, image, stock }` (see limitations) |
| GET | `/wishlist` | Private | Wishlist with product details |
| POST | `/wishlist/:productId` | Private | Add a product to the wishlist |
| DELETE | `/wishlist/:productId` | Private | Remove a product from the wishlist |
| GET | `/cart` | Private | Cart with product details |
| POST | `/cart/:productId` | Private | Add one unit (or +1 if already in cart) |
| PATCH | `/cart/:productId` | Private | Set quantity `{ quantity }` |
| DELETE | `/cart/:productId` | Private | Remove a product from the cart |
| POST | `/orders/create-payment-order` | Private | `{ shippingAddress }` → PENDING order + Razorpay order |
| POST | `/orders/verify-payment` | Private | `{ orderId, razorpay_order_id, razorpay_payment_id, razorpay_signature }` → verify, deduct stock, place order, clear cart |
| GET | `/orders` | Private | My orders, newest first |
| GET | `/orders/:id` | Private | One of my orders (another customer's order → 404) |

Request and response examples, status codes and `curl` commands are in [`[6] checkout-orders/backend copy/README.md`](%5B6%5D%20checkout-orders/backend%20copy/README.md).

---

## 12. Authentication and Authorization

- **Login** checks the bcrypt hash and signs a JWT `{ id }` with `JWT_SECRET` (expiry `JWT_EXPIRES_IN`, default 7 days).
- The token is sent as a cookie named `token` with `HttpOnly`, `SameSite=Strict` and `Secure` when `NODE_ENV=production`. JavaScript cannot read it, and the frontend never stores a token itself.
- **`protect` middleware** (`middlewares/auth.middleware.js`) verifies the JWT and reloads the customer from MongoDB on each request, so a deleted account is locked out at once.
- **Ownership**: wishlist, cart and orders are always queried by the signed-in customer's id. A customer cannot read or pay another customer's order.
- **Frontend**: `ProtectedRoute` calls `GET /customers/me`; on failure it redirects to `/login`.
- There are **no roles** (no admin user). See [Known Limitations](#18-known-limitations).

---

## 13. Seed Data

```bash
cd "[6] checkout-orders/backend copy"
npm run seed
```

This upserts 10 products across the categories Electronics, Fashion, Books and Home. It matches by product name, so running it again does not create duplicates and does not touch other products. One product has `stock: 0` to demonstrate the out-of-stock state. No user accounts are seeded; register through the UI.

---

## 14. Testing

All of these were run successfully against a throwaway MongoDB replica set during submission preparation.

| Check | Command (from the stage folder) | Needs |
| --- | --- | --- |
| Frontend lint | `npm run lint` | – |
| Frontend build | `npm run build` | – |
| Stock-deduction tests (9) | `npm test` | `MONGODB_URI` |
| Catalog + wishlist smoke test | `bash scripts/test-catalog.sh` | Running server on :8000 |
| Cart smoke test | `bash scripts/test-cart.sh` | Running server, seeded products |
| Orders/payment smoke test | `node scripts/test-orders.js` | Running server, a product with stock |

Notes:
- `npm test` uses a **separate database named `shopkart_test`** on the cluster in `MONGODB_URI` and empties that database's collections. It replaces Razorpay with a fake, so no network calls are made.
- The smoke-test scripts create test users and orders through the real API; `test-orders.js` deletes what it created. They read the API URL from `API` (default `http://localhost:8000`).

---

## 15. Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| `[db] MONGODB_URI is not defined in the environment` | No `.env` in the backend folder. Run `cp .env.example .env` inside `[6] checkout-orders/backend copy`. |
| `[db] MongoDB connection failed: …` | Wrong URI or password, local `mongod` not running, or (Atlas) your IP is not in *Network Access*. URL-encode special characters in the password (`@` → `%40`). |
| `[server] Port 5000 is already in use` (macOS) | AirPlay Receiver uses port 5000. Set `PORT=8000` in `.env`. |
| UI shows "Cannot reach the server. Is the backend running on port 8000?" | Start the backend, and make sure `PORT` is `8000`, or set `VITE_API_URL` in the frontend `.env.local` and restart `npm run dev`. |
| CORS error in the browser console, or every request fails | The page origin does not match `CLIENT_URL` (default `http://localhost:5173`). Open exactly `http://localhost:5173` (not `127.0.0.1:5173`), or set `CLIENT_URL` to the origin you actually use and restart the backend. |
| Login shows "Server error", and the backend logs `JWT_SECRET is not defined` | Set `JWT_SECRET` in the backend `.env` and restart. |
| Checkout says "Payments are not configured on the server" (503) | Add `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` (test mode) to `.env` and restart the backend. |
| "Only Razorpay test-mode keys (rzp_test_...) are allowed" | A live key was configured; use test-mode keys. |
| `npm install` fails or Vite refuses to start | Node.js is too old. Install 20.19+ or 22.13+. |
| `cd: no such file or directory` | Quote folder names: `cd "[6] checkout-orders/backend copy"`. |

---

## 16. Security Notes

- **Never commit `.env` files.** The root `.gitignore` ignores `.env` and `.env.*` in every folder; only `.env.example` templates (placeholder values only) are tracked.
- Before pushing, check that no environment file is tracked: `git ls-files | grep -E '(^|/)\.env'` should list only `.env.example` files.
- Use a long random `JWT_SECRET`, and a different one per environment.
- Use Razorpay **test** keys only; the server refuses live keys.
- `RAZORPAY_KEY_SECRET`, `JWT_SECRET` and `MONGODB_URI` are server-only. Nothing secret belongs in the frontend or in any `VITE_*` variable.
- Implemented protections: bcrypt hashing, `HttpOnly` + `SameSite=Strict` cookie, string-type validation against NoSQL operator injection, regex escaping for search, a 10 kB body limit, generic 5xx error messages, server-side prices, constant-time signature comparison.
- If a credential is ever committed or pushed, **rotate it** (new Atlas password, new JWT secret, new Razorpay keys). Deleting the file in a later commit does not remove it from Git history.

---

## 17. Deployment

The project includes no deployment configuration (no Dockerfile, Procfile or hosting config), and it has not been deployed. To deploy it manually:

- **Backend** on any Node host: set every backend variable from section 7 in the host's environment settings, with `NODE_ENV=production` (requires HTTPS) and `CLIENT_URL=<frontend URL>`. Start command: `npm start`. Allow the host's outbound IPs in Atlas *Network Access*.
- **Frontend** on any static host: build with `VITE_API_URL=<backend URL> npm run build` and serve `dist/`. Configure a fallback to `index.html` so React Router deep links like `/products/:id` work.
- `SameSite=Strict` cookies are only sent when the frontend and backend are on the **same site** (e.g. `shop.example.com` and `api.example.com`). Two unrelated domains would break login unless the cookie settings are changed.

---

## 18. Known Limitations

- **`POST /products` is unauthenticated.** Anyone who can reach the API can create products. There is no admin role. Recommended fix: add `protect` plus an admin check to that route, or remove it and manage products only through `npm run seed`.
- No product update/delete endpoints, no admin dashboard, no order cancellation by the customer, no pagination.
- No login rate limiting, refresh tokens, token revocation, password reset or email verification. These are listed in the backend README under *Beyond the Lab Scope*.
- On a **standalone local MongoDB** (no replica set), a server crash in the middle of payment settlement can leave an order inconsistent. Atlas or any replica set avoids this by using transactions.
- If an automatic Razorpay refund fails, the order stays `PAID` + `CANCELLED` and needs a manual refund from the Razorpay dashboard.
- The full Razorpay Checkout popup flow in a browser was not exercised during submission preparation. Payment verification was tested with correctly computed signatures (no live Razorpay calls).
- There is no frontend test suite; the frontend is checked with ESLint and a production build.
- `npm audit` reports high-severity advisories in **development-only** packages (`nodemon`, which the scripts do not use, and `source-map-js`, used at build time). Production backend dependencies report 0 vulnerabilities.
- `index.js` falls back to port `5000` when `PORT` is unset; always set `PORT=8000` as in `.env.example`.
