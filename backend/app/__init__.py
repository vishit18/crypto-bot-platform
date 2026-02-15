import os
import threading

from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from dotenv import load_dotenv


db = SQLAlchemy()

def create_app():
    load_dotenv()

    app = Flask(__name__)
    CORS(app)

    app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv("DATABASE_URL")
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

    db.init_app(app)

    from . import models

    from .routes import main
    app.register_blueprint(main)

        # --- Start trading engine in production (Gunicorn) ---
    if os.getenv("START_ENGINE", "true").lower() == "true":
        from .price_service import run_trading_engine

        def _start_engine():
            with app.app_context():
                run_trading_engine(poll_interval_seconds=int(os.getenv("ENGINE_POLL_SECONDS", "10")))

        threading.Thread(target=_start_engine, daemon=True).start()
        print("[startup] Trading engine started")


    return app
