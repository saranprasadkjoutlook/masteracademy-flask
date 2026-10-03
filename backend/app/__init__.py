from pathlib import Path

from flask import Flask, jsonify, request, session

from config import Config
from .extensions import db


def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)
    if app.config["SQLALCHEMY_DATABASE_URI"].startswith("sqlite:///"):
        Path(app.instance_path).mkdir(parents=True, exist_ok=True)

    db.init_app(app)

    from .api import api
    app.register_blueprint(api)

    @app.after_request
    def add_cors_headers(response):
        origin = request.headers.get("Origin")
        if origin and origin in app.config["CORS_ORIGINS"]:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
            response.headers["Access-Control-Allow-Headers"] = "Content-Type"
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
            response.headers["Vary"] = "Origin"
        return response

    @app.errorhandler(413)
    def too_large(_error):
        return jsonify(error="Upload exceeds the 3 MB request limit."), 413

    with app.app_context():
        db.create_all()
        _seed_courses()

    return app


def _seed_courses():
    from .models import Course, Enrollment, Lesson

    if Course.query.first():
        return
    courses = [
        Course(id="course-os", title="Operating Systems", description="Learn the basics of operating systems, processes, memory, and file management.", icon="💻", tone="lilac", instructor="Master Academy"),
        Course(id="course-ai", title="Artificial Intelligence", description="Explore machine learning, intelligent systems, and practical AI concepts.", icon="🧠", tone="pink", instructor="Master Academy"),
        Course(id="course-software", title="Software Engineering", description="Build a foundation in software design, development, and testing.", icon="🧩", tone="mint", instructor="Master Academy"),
    ]
    db.session.add_all(courses)
    db.session.flush()
    db.session.add(Lesson(course_id="course-os", title="Course introduction", content_type="Text", content="Welcome to Operating Systems.", position=1))
    db.session.add(Enrollment(course_id="course-os", student_username="student"))
    db.session.commit()
