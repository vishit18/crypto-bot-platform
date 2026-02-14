from flask import Blueprint, request, jsonify
from . import db
from .models import Trade, TradeLog
from .price_service import get_btc_price_usd, get_btc_stats_usd

main = Blueprint("main", __name__)


@main.route("/price/live", methods=["GET"])
def price_live():
    stats = get_btc_stats_usd()
    if stats is None or stats.get("price") is None:
        return jsonify({"error": "price_unavailable"}), 503

    return jsonify({
        "symbol": "BTC/USD",
        "price": stats["price"],
        "change_24h": stats.get("change_24h"),
        "change_percent_24h": stats.get("change_percent_24h")
    })


@main.route("/trade/create", methods=["POST"])
def create_trade():
    data = request.get_json() or {}

    required_fields = ["symbol", "buy_price", "sell_price", "stop_loss", "quantity"]
    missing = [f for f in required_fields if data.get(f) is None]
    if missing:
        return jsonify({"error": "missing_fields", "fields": missing}), 400

    try:
        symbol = str(data.get("symbol"))
        buy_price = float(data.get("buy_price"))
        sell_price = float(data.get("sell_price"))
        stop_loss = float(data.get("stop_loss"))
        quantity = float(data.get("quantity"))
        user_id = int(data.get("user_id", 1))
    except (ValueError, TypeError):
        return jsonify({"error": "invalid_types"}), 400

    trade = Trade(
        user_id=user_id,
        symbol=symbol,
        buy_price=buy_price,
        sell_price=sell_price,
        stop_loss=stop_loss,
        quantity=quantity,
        status="pending"
    )

    db.session.add(trade)
    db.session.commit()  # so trade.id exists

    log = TradeLog(
        trade_id=trade.id,
        message="Trade created",
        price=buy_price
    )
    db.session.add(log)
    db.session.commit()

    return jsonify({
        "status": "success",
        "trade_id": trade.id,
        "message": "Trade created successfully"
    }), 201


@main.route("/trade/active", methods=["GET"])
def trade_active():
    current_price = get_btc_price_usd()
    if current_price is None:
        return jsonify({"error": "price_unavailable"}), 503

    trades = (
        Trade.query
        .filter(Trade.status.in_(["pending", "bought"]))
        .order_by(Trade.created_at.desc())
        .all()
    )

    payload = []
    for t in trades:
        unrealized_pnl = None
        unrealized_pnl_percent = None

        if t.status == "bought":
            unrealized_pnl = (current_price - t.buy_price) * t.quantity
            if t.buy_price != 0:
                unrealized_pnl_percent = ((current_price - t.buy_price) / t.buy_price) * 100

        payload.append({
            "id": t.id,
            "user_id": t.user_id,
            "symbol": t.symbol,
            "buy_price": t.buy_price,
            "sell_price": t.sell_price,
            "stop_loss": t.stop_loss,
            "quantity": t.quantity,
            "status": t.status,
            "created_at": t.created_at.isoformat(),
            "current_price": current_price,
            "unrealized_pnl": unrealized_pnl,
            "unrealized_pnl_percent": unrealized_pnl_percent
        })

    return jsonify(payload)


@main.route("/trade/history", methods=["GET"])
def trade_history():
    trades = (
        Trade.query
        .filter(Trade.status.in_(["sold", "stopped"]))
        .order_by(Trade.created_at.desc())
        .all()
    )

    results = []
    for t in trades:
        last_log = (
            TradeLog.query
            .filter_by(trade_id=t.id)
            .order_by(TradeLog.id.desc())
            .first()
        )

        exit_price = last_log.price if last_log else None

        pnl = None
        if exit_price is not None:
            pnl = (exit_price - t.buy_price) * t.quantity

        results.append({
            "id": t.id,
            "symbol": t.symbol,
            "status": t.status,
            "buy_price": t.buy_price,
            "exit_price": exit_price,
            "quantity": t.quantity,
            "pnl": pnl,
            "created_at": t.created_at.isoformat()
        })

    return jsonify(results)


@main.route("/trade/<int:trade_id>/logs", methods=["GET"])
def trade_logs(trade_id: int):
    logs = (
        TradeLog.query
        .filter_by(trade_id=trade_id)
        .order_by(TradeLog.id.asc())
        .all()
    )

    return jsonify([
        {
            "id": l.id,
            "trade_id": l.trade_id,
            "message": l.message,
            "price": l.price,
            "timestamp": l.timestamp.isoformat()
        }
        for l in logs
    ])

@main.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"}), 200
