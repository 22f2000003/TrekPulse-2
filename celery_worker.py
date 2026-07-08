from run import app, celery_app
import app.tasks  # Load tasks to ensure Celery discovers and registers them

celery = celery_app
