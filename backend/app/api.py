import hmac
import re
import uuid
from functools import wraps

from flask import Blueprint, current_app, jsonify, request, session
from sqlalchemy.exc import IntegrityError

from .extensions import db
from .models import Course, Enrollment, Lesson


api = Blueprint("api", __name__, url_prefix="/api")
CONTENT_TYPES = {"Text", "Image", "Audio", "Video", "PDF"}
USERS = {
    "admin": {"name": "Admin", "role": "admin"},
    "student": {"name": "Student", "role": "student"},
    "student2": {"name": "Alex Morgan", "role": "student"},
}


def json_body():
    return request.get_json(silent=True) or {}


def login_required(role=None):
    def decorator(handler):
        @wraps(handler)
        def wrapped(*args, **kwargs):
            if request.method == "OPTIONS":
                return "", 204
            user = session.get("user")
            if not user:
                return jsonify(error="Sign in is required."), 401
            if role and user["role"] != role:
                return jsonify(error="You do not have permission for this action."), 403
            return handler(*args, **kwargs)
        return wrapped
    return decorator


def user_password(username):
    if username == "admin":
        return current_app.config["ADMIN_PASSWORD"]
    return current_app.config["STUDENT_PASSWORD"]


def course_json(course):
    return {
        "id": course.id,
        "title": course.title,
        "description": course.description,
        "icon": course.icon,
        "tone": course.tone,
        "instructor": course.instructor,
        "students": [row.student_username for row in course.enrollments],
        "lessons": [lesson_json(lesson) for lesson in course.lessons],
    }


def lesson_json(lesson):
    return {
        "id": lesson.id,
        "title": lesson.title,
        "type": lesson.content_type,
        "content": lesson.content,
        "fileName": lesson.file_name,
        "position": lesson.position,
    }


@api.route("/health", methods=["GET", "OPTIONS"])
def health():
    return jsonify(status="ok")


@api.route("/login", methods=["POST", "OPTIONS"])
def login():
    if request.method == "OPTIONS":
        return "", 204
    body = json_body()
    username = str(body.get("username", "")).strip()
    password = str(body.get("password", ""))
    user = USERS.get(username)
    if not user or not hmac.compare_digest(password, user_password(username)):
        return jsonify(error="Invalid username or password."), 401
    session.clear()
    session["user"] = {"username": username, **user}
    return jsonify(user=session["user"])


@api.route("/logout", methods=["POST", "OPTIONS"])
def logout():
    if request.method == "OPTIONS":
        return "", 204
    session.clear()
    return jsonify(status="ok")


@api.route("/me", methods=["GET", "OPTIONS"])
def me():
    if request.method == "OPTIONS":
        return "", 204
    user = session.get("user")
    if not user:
        return jsonify(error="Sign in is required."), 401
    return jsonify(user=user)


@api.route("/courses", methods=["GET", "POST", "OPTIONS"])
def courses():
    if request.method == "OPTIONS":
        return "", 204
    if request.method == "POST":
        user = session.get("user")
        if not user:
            return jsonify(error="Sign in is required."), 401
        if user["role"] != "admin":
            return jsonify(error="Only admins can create courses."), 403
        body = json_body()
        title = str(body.get("title", "")).strip()
        description = str(body.get("description", "")).strip()
        if not title or not description:
            return jsonify(error="Course title and description are required."), 400
        course = Course(
            id=f"course-{uuid.uuid4().hex}",
            title=title[:120], description=description[:500],
            icon=str(body.get("icon", "📘"))[:16],
            tone=str(body.get("tone", "lilac"))[:20], instructor=user["name"],
        )
        db.session.add(course)
        db.session.commit()
        return jsonify(course=course_json(course)), 201

    user = session.get("user")
    if not user:
        return jsonify(error="Sign in is required."), 401
    query = Course.query
    if user["role"] == "student":
        only_mine = request.args.get("mine", "false").lower() == "true"
        if only_mine:
            query = query.join(Enrollment).filter(Enrollment.student_username == user["username"])
    return jsonify(courses=[course_json(course) for course in query.order_by(Course.created_at, Course.title).all()])


@api.route("/courses/<course_id>/lessons", methods=["GET", "POST", "OPTIONS"])
def course_lessons(course_id):
    if request.method == "OPTIONS":
        return "", 204
    course = db.session.get(Course, course_id)
    if not course:
        return jsonify(error="Course not found."), 404
    if request.method == "GET":
        if not session.get("user"):
            return jsonify(error="Sign in is required."), 401
        return jsonify(lessons=[lesson_json(lesson) for lesson in course.lessons])
    user = session.get("user")
    if not user:
        return jsonify(error="Sign in is required."), 401
    if user["role"] != "admin":
        return jsonify(error="Only admins can add lessons."), 403
    body = json_body()
    title = str(body.get("title", "")).strip()
    content_type = str(body.get("type", "Text"))
    content = body.get("content", "")
    file_name = body.get("fileName") or body.get("file_name")
    if not title:
        return jsonify(error="Lesson title is required."), 400
    if content_type not in CONTENT_TYPES:
        return jsonify(error="Content type must be Text, Image, Audio, Video, or PDF."), 400
    if not isinstance(content, str) or (content_type == "Text" and not content.strip()):
        return jsonify(error="Lesson content is required."), 400
    if content_type != "Text" and not content:
        return jsonify(error="Uploaded file content is required."), 400
    if content_type != "Text" and not is_allowed_upload(content_type, content):
        return jsonify(error="The uploaded content does not match its selected type."), 400
    lesson = Lesson(
        course_id=course.id, title=title[:160], content_type=content_type,
        content=content, file_name=str(file_name)[:255] if file_name else None,
        position=len(course.lessons) + 1,
    )
    db.session.add(lesson)
    db.session.commit()
    return jsonify(lesson=lesson_json(lesson)), 201


def is_allowed_upload(content_type, content):
    match = re.match(r"^data:([^;,]+);base64,", content, re.IGNORECASE)
    if not match:
        return False
    mime = match.group(1).lower()
    if content_type == "Image":
        return mime.startswith("image/")
    if content_type == "Audio":
        return mime.startswith("audio/")
    if content_type == "Video":
        return mime.startswith("video/")
    return mime == "application/pdf"


@api.route("/courses/<course_id>/enrollments", methods=["POST", "OPTIONS"])
@login_required()
def enroll(course_id):
    course = db.session.get(Course, course_id)
    if not course:
        return jsonify(error="Course not found."), 404
    user = session["user"]
    body = json_body()
    if user["role"] == "admin":
        username = str(body.get("username", "")).strip()
        if username not in {"student", "student2"}:
            return jsonify(error="Choose a valid student username."), 400
    else:
        username = user["username"]
    enrollment = Enrollment.query.filter_by(course_id=course.id, student_username=username).first()
    if not enrollment:
        enrollment = Enrollment(course_id=course.id, student_username=username)
        db.session.add(enrollment)
        try:
            db.session.commit()
        except IntegrityError:
            db.session.rollback()
    return jsonify(enrollment={"courseId": course.id, "username": username}), 201
