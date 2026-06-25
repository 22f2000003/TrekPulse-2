from datetime import datetime
from app import db
from flask_login import UserMixin

class User(db.Model, UserMixin):
    __tablename__ = 'user'

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(64), unique=True, nullable=False, index=True)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(256), nullable=False)
    role = db.Column(db.String(20), nullable=False)  # 'admin', 'staff', 'trekker'
    status = db.Column(db.String(20), nullable=False, default='approved')  # 'pending', 'approved', 'blacklisted'
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    # Relationships
    staff_profile = db.relationship('StaffProfile', back_populates='user', uselist=False, cascade="all, delete-orphan")
    bookings = db.relationship('Booking', back_populates='trekker', cascade="all, delete-orphan")
    assigned_treks = db.relationship('Trek', back_populates='assigned_staff', foreign_keys='Trek.assigned_staff_id')
    notifications = db.relationship('Notification', back_populates='user', cascade="all, delete-orphan")

    @property
    def is_active(self):
        return self.status == 'approved'

    def __repr__(self):
        return f"<User {self.username} ({self.role})>"

class StaffProfile(db.Model):
    __tablename__ = 'staff_profile'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), unique=True, nullable=False)
    name = db.Column(db.String(100), nullable=False)
    contact_details = db.Column(db.String(200), nullable=True)

    user = db.relationship('User', back_populates='staff_profile')

    def __repr__(self):
        return f"<StaffProfile {self.name}>"

class Trek(db.Model):
    __tablename__ = 'trek'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
    location = db.Column(db.String(100), nullable=False)
    difficulty = db.Column(db.String(20), nullable=False)  # 'Easy', 'Moderate', 'Hard'
    duration = db.Column(db.Integer, nullable=False)  # in days
    total_slots = db.Column(db.Integer, nullable=False)
    available_slots = db.Column(db.Integer, nullable=False)
    assigned_staff_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    status = db.Column(db.String(20), nullable=False, default='Pending')  # 'Pending', 'Approved', 'Open', 'Closed', 'Completed'
    start_date = db.Column(db.Date, nullable=False)
    end_date = db.Column(db.Date, nullable=False)

    assigned_staff = db.relationship('User', back_populates='assigned_treks', foreign_keys=[assigned_staff_id])
    bookings = db.relationship('Booking', back_populates='trek', cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Trek {self.name} ({self.status})>"

class Booking(db.Model):
    __tablename__ = 'booking'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    trek_id = db.Column(db.Integer, db.ForeignKey('trek.id'), nullable=False)
    booking_date = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    status = db.Column(db.String(20), nullable=False, default='Booked')  # 'Booked', 'Cancelled'

    trekker = db.relationship('User', back_populates='bookings')
    trek = db.relationship('Trek', back_populates='bookings')

    def __repr__(self):
        return f"<Booking {self.id} for User {self.user_id} on Trek {self.trek_id}>"

class Notification(db.Model):
    __tablename__ = 'notification'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    message = db.Column(db.Text, nullable=False)
    type = db.Column(db.String(50), nullable=False, default='info')  # 'info', 'csv_export', 'reminder'
    link = db.Column(db.String(256), nullable=True)
    is_read = db.Column(db.Boolean, nullable=False, default=False)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    user = db.relationship('User', back_populates='notifications')

    def __repr__(self):
        return f"<Notification {self.id} for User {self.user_id}>"
