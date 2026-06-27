from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager
from flask_caching import Cache
from celery import Celery, Task

db = SQLAlchemy()
login_manager = LoginManager()
cache = Cache()

def celery_init_app(app: Flask) -> Celery:
    class FlaskTask(Task):
        def __call__(self, *args: object, **kwargs: object) -> object:
            with app.app_context():
                return self.run(*args, **kwargs)

    celery_app = Celery(app.name, task_cls=FlaskTask)
    # Configure broker and backend directly
    celery_app.conf.update(
        broker_url=app.config.get('CELERY_BROKER_URL'),
        result_backend=app.config.get('CELERY_RESULT_BACKEND'),
        timezone='UTC',
        broker_connection_retry_on_startup=True,
        task_always_eager=app.config.get('CELERY_TASK_ALWAYS_EAGER', False)
    )
    celery_app.set_default()
    app.extensions["celery"] = celery_app
    return celery_app

def create_app(config_class=None):
    if config_class is None:
        from config import Config
        config_class = Config

    app = Flask(__name__)
    app.config.from_object(config_class)

    # Initialize extensions
    db.init_app(app)
    login_manager.init_app(app)
    login_manager.login_view = 'auth.login'
    login_manager.login_message_category = 'warning'
    
    # Initialize cache
    cache.init_app(app)

    # Setup User Loader
    from app.models import User
    @login_manager.user_loader
    def load_user(user_id):
        return db.session.get(User, int(user_id))

    # Register blueprints
    from app.routes.main import main_bp
    from app.routes.auth import auth_bp
    from app.routes.admin import admin_bp
    from app.routes.staff import staff_bp
    from app.routes.trekker import trekker_bp

    app.register_blueprint(main_bp)
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(admin_bp, url_prefix='/api/admin')
    app.register_blueprint(staff_bp, url_prefix='/api/staff')
    app.register_blueprint(trekker_bp, url_prefix='/api/trekker')

    # Register CLI commands
    from app.commands import seed_db_command
    app.cli.add_command(seed_db_command)

    return app
