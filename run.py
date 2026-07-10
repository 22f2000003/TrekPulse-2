from app import create_app, celery_init_app

app = create_app()
celery_app = celery_init_app(app)

if __name__ == '__main__':
    app.run(debug=True)
