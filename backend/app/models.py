from datetime import datetime, timezone

from .extensions import db


def utc_now():
    return datetime.now(timezone.utc)


class Course(db.Model):
    __tablename__ = "courses"

    id = db.Column(db.String(40), primary_key=True)
    title = db.Column(db.String(120), nullable=False)
    description = db.Column(db.String(500), nullable=False, default="")
    icon = db.Column(db.String(16), nullable=False, default="📘")
    tone = db.Column(db.String(20), nullable=False, default="lilac")
    instructor = db.Column(db.String(120), nullable=False, default="Master Academy")
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utc_now)
    lessons = db.relationship(
        "Lesson", back_populates="course", cascade="all, delete-orphan",
        order_by="Lesson.position, Lesson.created_at",
    )
    enrollments = db.relationship(
        "Enrollment", back_populates="course", cascade="all, delete-orphan"
    )


class Lesson(db.Model):
    __tablename__ = "lessons"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    course_id = db.Column(db.String(40), db.ForeignKey("courses.id", ondelete="CASCADE"), nullable=False, index=True)
    title = db.Column(db.String(160), nullable=False)
    content_type = db.Column(db.String(16), nullable=False)
    content = db.Column(db.UnicodeText, nullable=False, default="")
    file_name = db.Column(db.String(255))
    position = db.Column(db.Integer, nullable=False, default=0)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utc_now)
    course = db.relationship("Course", back_populates="lessons")


class Enrollment(db.Model):
    __tablename__ = "enrollments"
    __table_args__ = (db.UniqueConstraint("course_id", "student_username", name="uq_course_student"),)

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    course_id = db.Column(db.String(40), db.ForeignKey("courses.id", ondelete="CASCADE"), nullable=False, index=True)
    student_username = db.Column(db.String(50), nullable=False, index=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utc_now)
    course = db.relationship("Course", back_populates="enrollments")
