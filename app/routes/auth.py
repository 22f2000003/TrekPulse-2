from flask import Blueprint, request, jsonify
from flask_login import login_user, logout_user, login_required, current_user
from werkzeug.security import generate_password_hash, check_password_hash
from app import db
from app.models import User
import re

auth_bp = Blueprint('auth', __name__)

# Basic email validation regex
EMAIL_REGEX = re.compile(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')

@auth_bp.route('/register', methods=['POST'])
def register():
    if current_user.is_authenticated:
        return jsonify({'error': 'Already authenticated'}), 400

    data = request.get_json() or {}
    username = data.get('username', '').strip()
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')

    # Validation
    if not username or not email or not password:
        return jsonify({'error': 'Username, email, and password are required.'}), 400

    if len(username) < 3 or len(username) > 64:
        return jsonify({'error': 'Username must be between 3 and 64 characters.'}), 400

    if not EMAIL_REGEX.match(email):
        return jsonify({'error': 'Invalid email address format.'}), 400

    if len(password) < 6:
        return jsonify({'error': 'Password must be at least 6 characters long.'}), 400

    # Check duplicates
    if User.query.filter_by(username=username).first():
        return jsonify({'error': 'Username already exists.'}), 400
    if User.query.filter_by(email=email).first():
        return jsonify({'error': 'Email address already registered.'}), 400

    # Create Trekker User (only trekkers can register)
    try:
        user = User(
            username=username,
            email=email,
            password_hash=generate_password_hash(password),
            role='trekker',
            status='approved'
        )
        db.session.add(user)
        db.session.commit()
        return jsonify({'success': True, 'message': 'Registration successful! You can now log in.'}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Database error: {str(e)}'}), 500


@auth_bp.route('/login', methods=['POST'])
def login():
    if current_user.is_authenticated:
        return jsonify({
            'success': True,
            'user': {
                'id': current_user.id,
                'username': current_user.username,
                'email': current_user.email,
                'role': current_user.role
            }
        }), 200

    data = request.get_json() or {}
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')

    if not email or not password:
        return jsonify({'error': 'Email and password are required.'}), 400

    user = User.query.filter_by(email=email).first()

    if not user or not check_password_hash(user.password_hash, password):
        return jsonify({'error': 'Invalid email or password.'}), 401

    if user.status == 'pending':
        return jsonify({'error': 'Your staff registration request is pending Admin approval.'}), 403
    elif user.status == 'blacklisted':
        return jsonify({'error': 'Your account has been deactivated or blacklisted by the Admin.'}), 403

    login_user(user, remember=data.get('remember', False))
    return jsonify({
        'success': True,
        'message': f'Welcome back, {user.username}!',
        'user': {
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'role': user.role
        }
    }), 200


@auth_bp.route('/logout', methods=['POST'])
@login_required
def logout():
    logout_user()
    return jsonify({'success': True, 'message': 'You have been successfully logged out.'}), 200


@auth_bp.route('/me', methods=['GET'])
def me():
    if current_user.is_authenticated:
        return jsonify({
            'authenticated': True,
            'user': {
                'id': current_user.id,
                'username': current_user.username,
                'email': current_user.email,
                'role': current_user.role
            }
        }), 200
    return jsonify({'authenticated': False}), 200
