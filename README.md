# Crypto Trading Bot Mini Platform

Live Frontend:
https://crypto-bot-platform.vercel.app/

Backend API:
https://crypto-bot-platform-production.up.railway.app/

---

## Overview

This project is a production-style crypto trading simulation platform built to demonstrate backend architecture, trading logic, database design, and real-time UI updates.

The system simulates a simplified crypto exchange and automatically executes trades based on user-defined price conditions.

It supports:

- Configurable Buy, Take-Profit, and Stop-Loss
- Live BTC price integration (CoinGecko)
- Automated trade lifecycle management
- Real-time logs
- Unrealized and realized P&L calculations
- Full deployment (Backend + Frontend)

Real money trading is NOT performed.

---

## Tech Stack

| Layer | Technology |
|--------|------------|
| Backend | Python (Flask) |
| ORM | SQLAlchemy |
| Database | MySQL |
| Frontend | React (Vite) |
| Styling | Tailwind CSS |
| Real-Time | Smart Polling |
| Price Source | CoinGecko Public API |
| Deployment | Railway (Backend), Vercel (Frontend) |

---

## System Architecture

### High-Level Flow

1. Frontend polls backend every 3 seconds.
2. Backend polls CoinGecko every 10 seconds with caching.
3. A background trading engine evaluates active trades.
4. Trade state transitions are executed automatically.
5. All lifecycle events are logged in the database.
6. UI updates without page reload.

### Backend Modules

- `price_service.py`
  - Fetches live price
  - Implements caching to avoid rate limits
  - Runs background trading engine
  - Executes buy/sell/stop-loss logic

- `routes.py`
  - REST API endpoints
  - Input validation
  - P&L calculations

- `models.py`
  - SQLAlchemy models
  - Foreign key relationships
  - Data integrity enforcement

---

## Trading Engine Logic

The trading engine continuously monitors BTC price.

### Lifecycle

1. Trade created → `pending`
2. If `current_price ≤ buy_price` → `bought`
3. After bought:
   - If `current_price ≥ sell_price` → `sold`
   - If `current_price ≤ stop_loss` → `stopped`
4. Trade closes automatically
5. Final state logged
6. History endpoint calculates realized P&L

The engine runs in a background thread inside the Flask application context.

---

## Real-Time Strategy

Smart Polling was selected over WebSockets and SSE.

Why:

- Simpler architecture
- Reliable under rate limits
- Lower operational complexity

Polling Intervals:

- Frontend → Backend: 3 seconds
- Backend → CoinGecko: 10 seconds (cached)

This prevents API exhaustion while maintaining real-time responsiveness.

---

## Database Design

### users

| Field | Type |
|-------|------|
| id | int (PK) |
| name | varchar |
| email | varchar (unique) |

### trades

| Field | Type |
|-------|------|
| id | int (PK) |
| user_id | int (FK → users.id) |
| symbol | varchar |
| buy_price | float |
| sell_price | float |
| stop_loss | float |
| quantity | float |
| status | pending / bought / sold / stopped |
| created_at | datetime |

### trade_logs

| Field | Type |
|-------|------|
| id | int (PK) |
| trade_id | int (FK → trades.id) |
| message | text |
| price | float |
| timestamp | datetime |

### Relationships

- One User → Many Trades
- One Trade → Many Trade Logs

Foreign keys enforce referential integrity and prevent orphan records.

---

## REST API Documentation

### GET /price/live

Returns live BTC price and 24h change.

Response:
```json
{
  "symbol": "BTC/USD",
  "price": 69000,
  "change_24h": -500,
  "change_percent_24h": -0.72
}
```

---

### POST /trade/create

Creates a new trade.

Request:
```json
{
  "symbol": "BTC/USDT",
  "buy_price": 60000,
  "sell_price": 65000,
  "stop_loss": 55000,
  "quantity": 0.1,
  "user_id": 1
}
```

Response:
```json
{
  "status": "success",
  "trade_id": 4
}
```

---

### GET /trade/active

Returns pending and bought trades including unrealized P&L.

---

### GET /trade/history

Returns completed trades including realized P&L.

---

### GET /trade/<trade_id>/logs

Returns chronological logs for a trade.

---

## Local Setup

### Backend

```
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

Create `.env`:

```
DATABASE_URL=mysql+pymysql://root:YOUR_PASSWORD@localhost:3306/crypto_bot
```

Run:

```
python run.py
```

---

### Frontend

```
cd frontend
npm install
```

Create `.env`:

```
VITE_API_URL=http://127.0.0.1:5000
```

Run:

```
npm run dev
```

---

## Deployment

Backend:
Railway (Gunicorn production server)

Frontend:
Vercel (Vite build output)

Environment variables configured securely on both platforms.

---

## Key Engineering Decisions

- Used SQLAlchemy ORM for maintainable DB abstraction
- Implemented caching to handle CoinGecko rate limits
- Background thread for automated trade execution
- Clean separation of concerns (routes, models, services)
- Real-time UI without page reload

---

## Demo Capabilities

- Live BTC price feed
- Create trade
- Automatic buy execution
- Automatic take-profit
- Automatic stop-loss
- Real-time logs
- Trade history with P&L

---

## Future Improvements

- Authentication system
- Multi-user support
- WebSocket upgrade
- Multiple trading pairs
- Dockerized deployment
- Portfolio dashboard

---

This project demonstrates backend logic design, state management, database relationships, and real-time frontend integration.
