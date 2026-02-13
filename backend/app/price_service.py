import time
import requests

from .models import Trade, TradeLog
from . import db

COINGECKO_URL = "https://api.coingecko.com/api/v3/simple/price"

# --- simple in-memory cache to avoid CoinGecko rate-limits ---
_last_price = None
_last_fetch_ts = 0.0


def get_btc_price_usd(min_fetch_interval_seconds: int = 30) -> float | None:
    """
    Fetch live BTC price in USD from CoinGecko.
    Uses a small in-memory cache to avoid 429 rate-limit errors.
    Returns:
        price (float) or None if no price is available yet.
    """
    global _last_price, _last_fetch_ts

    now = time.time()

    # return cached price if it's fresh enough
    if _last_price is not None and (now - _last_fetch_ts) < min_fetch_interval_seconds:
        return _last_price

    try:
        resp = requests.get(
            COINGECKO_URL,
            params={"ids": "bitcoin", "vs_currencies": "usd"},
            timeout=5
        )

        # if rate-limited, use cached price
        if resp.status_code == 429:
            print("[price_service] Rate limited (429). Using cached price.")
            return _last_price

        resp.raise_for_status()
        data = resp.json()

        _last_price = float(data["bitcoin"]["usd"])
        _last_fetch_ts = now
        return _last_price

    except Exception as e:
        print(f"[price_service] Price fetch failed: {e}. Using cached price.")
        return _last_price


def _log_trade_event(trade_id: int, message: str, price: float) -> None:
    log = TradeLog(
        trade_id=trade_id,
        message=message,
        price=price
    )
    db.session.add(log)


def check_trades_once() -> None:
    """
    One engine cycle:
    - get current price
    - check pending/bought trades
    - update status + add logs
    - commit once
    """
    current_price = get_btc_price_usd()
    if current_price is None:
        return

    active_trades = Trade.query.filter(Trade.status.in_(["pending", "bought"])).all()

    for trade in active_trades:
        # pending -> bought
        if trade.status == "pending" and current_price <= trade.buy_price:
            trade.status = "bought"
            db.session.add(trade)
            _log_trade_event(trade.id, f"Buy executed at {current_price}", current_price)
            continue

        # bought -> sold or stopped
        if trade.status == "bought":
            if current_price >= trade.sell_price:
                trade.status = "sold"
                db.session.add(trade)
                _log_trade_event(trade.id, f"Take-profit hit at {current_price}", current_price)
                continue

            if current_price <= trade.stop_loss:
                trade.status = "stopped"
                db.session.add(trade)
                _log_trade_event(trade.id, f"Stop-loss triggered at {current_price}", current_price)
                continue

    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        print(f"[price_service] DB commit failed: {e}")


def run_trading_engine(poll_interval_seconds: int = 10) -> None:
    """
    Runs forever. Should be started from a background thread under app context.
    """
    while True:
        try:
            check_trades_once()
        except Exception as e:
            db.session.rollback()
            print(f"[price_service] Engine cycle error: {e}")
        time.sleep(poll_interval_seconds)
