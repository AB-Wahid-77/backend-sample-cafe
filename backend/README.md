# Amber & Ash — Backend API

Backend service for **Amber & Ash**, an artisan café & roastery. This is
**Part 1** of a multi-part backend build: it establishes the permanent
technical foundation (server, configuration, database connection, health
check) that every later part will extend — nothing here is temporary or
throwaway.

## Technologies

- Node.js
- Express.js
- MongoDB Atlas (cloud-hosted — see note below)
- Mongoose
- dotenv
- cors
- nodemon (development only)

## Folder structure

```
backend/
│
├── src/
│   ├── config/
│   │   ├── env.js          # loads & validates environment variables
│   │   └── db.js           # single MongoDB (Mongoose) connection function
│   │
│   ├── controllers/
│   │   └── healthController.js
│   │
│   ├── middleware/
│   │   ├── errorHandler.js # centralized error handler (JSON, no leaks)
│   │   └── notFound.js     # JSON 404 for unmatched routes
│   │
│   ├── routes/
│   │   ├── index.js        # mounts all /api/v1 routes
│   │   └── healthRoutes.js
│   │
│   └── app.js               # builds the Express app (no app.listen here)
│
├── server.js                 # entry point: env → db → server, in order
├── .env                       # real config (never committed)
├── .env.example                # placeholder config (safe to commit)
├── .gitignore
├── package.json
└── README.md
```

## Requirements

- **Node.js** (v18+ recommended)
- **MongoDB Atlas** account — this is a cloud database service accessed
  over the internet. **You do not need to install MongoDB Server or
  MongoDB Compass locally**; you only need a connection string from your
  Atlas cluster.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create your `.env` file (a starter one is already included, but if
   you need to recreate it, copy `.env.example`):

   ```bash
   cp .env.example .env
   ```

3. Edit `.env` and set your real MongoDB Atlas connection string:

   ```
   PORT=5000
   NODE_ENV=development
   MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>/<database>
   ```

   Get this string from the Atlas dashboard → **Connect** → **Drivers**.
   Replace `<username>`, `<password>`, and `<cluster>` with your own
   values. If your URI doesn't already include a database name, the app
   will use `amber_and_ash` conceptually — but whatever database name is
   already in your URI is preserved and used as-is.

## Run

Development (auto-restart on file changes):

```bash
npm run dev
```

Production:

```bash
npm start
```

On a successful start you should see console output indicating, in
order: the environment was loaded, MongoDB connected, and the server is
running on the configured port.

## Health check

Once running, open:

```
GET http://localhost:5000/api/v1/health
```

Expected response:

```json
{
  "success": true,
  "message": "Amber & Ash API is running",
  "database": "connected",
  "environment": "development"
}
```

The `database` field reflects Mongoose's real connection state — it is
never hard-coded.

## Scope of Part 1

**Implemented:**
- Project structure and configuration
- Environment loading & validation
- Single MongoDB Atlas connection (via Mongoose, in `src/config/db.js`)
- Ordered startup sequence (env → db → server)
- `GET /api/v1/health`
- `GET /` root route
- JSON 404 handling
- Centralized JSON error handling
- CORS (open for local dev, easy to restrict later)

**Intentionally postponed to later parts:**
- Admin authentication (JWT, bcrypt)
- Products/Menu management
- Orders/Checkout
- Reservations
- Contact messages
- Newsletter subscribers
- Admin management APIs
- Any business data models (Product, Order, User, Reservation, etc.)

This backend is designed to be **extended**, not rebuilt — future parts
will add to this same project.
