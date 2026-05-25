from flask import Flask, render_template

from app.api import api_bp
from app.config import BASE_DIR, Config


def create_app(config_class: type = Config) -> Flask:
    app = Flask(
        __name__,
        template_folder=str(BASE_DIR / "templates"),
        static_folder=str(BASE_DIR / "static"),
        static_url_path="/static",
    )
    app.config.from_object(config_class)

    app.register_blueprint(api_bp)

    @app.get("/")
    def index():
        return render_template("type1.html")

    @app.get("/type2")
    def index_type2():
        return render_template("type2.html")

    @app.get("/type3")
    def index_type3():
        return render_template("type3.html")

    @app.get("/type4")
    def index_type4():
        return render_template("type4.html")

    return app
