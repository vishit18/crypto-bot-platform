import threading
from app import create_app, db
from app.price_service import run_trading_engine

app = create_app()

with app.app_context():
    db.create_all()

def start_engine():
    with app.app_context():
        run_trading_engine(poll_interval_seconds=10)  # start at 10s for now

if __name__ == "__main__":
    engine_thread = threading.Thread(target=start_engine, daemon=True)
    engine_thread.start()

    # IMPORTANT: disable reloader so engine doesn't start twice
    app.run(debug=True, use_reloader=False)
