from flask import Blueprint, jsonify, request
from flask_login import login_required, current_user
from app import db, cache
from app.models import Trek, Booking, User, StaffProfile
from werkzeug.security import generate_password_hash
from datetime import datetime

admin_bp = Blueprint('admin', __name__)

def check_admin_role():
    if current_user.role != 'admin':
        return jsonify({'error': 'Access denied. Administrators only.'}), 403
    return None

@admin_bp.route('/stats', methods=['GET'])
@login_required
def get_stats():
    role_error = check_admin_role()
    if role_error:
        return role_error

    total_treks = Trek.query.count()
    total_users = User.query.filter_by(role='trekker').count()
    total_staff = User.query.filter_by(role='staff').count()
    total_bookings = Booking.query.count()

    # Metrics for ChartJS
    # Difficulty count
    difficulty_counts = {}
    for d in ['Easy', 'Moderate', 'Hard']:
        difficulty_counts[d] = Trek.query.filter(Trek.difficulty.ilike(d)).count()

    # Status counts
    status_counts = {}
    for s in ['Pending', 'Approved', 'Open', 'Closed', 'Completed']:
        status_counts[s] = Trek.query.filter(Trek.status.ilike(s)).count()

    # Popular treks
    popular = db.session.query(
        Trek.name, db.func.count(Booking.id).label('booking_count')
    ).outerjoin(Booking).group_by(Trek.id).order_by(db.desc('booking_count')).limit(5).all()

    popular_list = [{'name': name, 'count': count} for name, count in popular]

    return jsonify({
        'total_treks': total_treks,
        'total_users': total_users,
        'total_staff': total_staff,
        'total_bookings': total_bookings,
        'by_difficulty': difficulty_counts,
        'by_status': status_counts,
        'popular_treks': popular_list
    })

@admin_bp.route('/treks', methods=['GET'])
@login_required
def get_all_treks():
    role_error = check_admin_role()
    if role_error:
        return role_error

    treks = Trek.query.all()
    treks_list = []
    for t in treks:
        treks_list.append({
            'id': t.id,
            'name': t.name,
            'location': t.location,
            'difficulty': t.difficulty,
            'duration': t.duration,
            'total_slots': t.total_slots,
            'available_slots': t.available_slots,
            'status': t.status,
            'start_date': t.start_date.strftime('%Y-%m-%d'),
            'end_date': t.end_date.strftime('%Y-%m-%d'),
            'assigned_staff_id': t.assigned_staff_id,
            'assigned_staff_name': t.assigned_staff.staff_profile.name if (t.assigned_staff and t.assigned_staff.staff_profile) else 'None'
        })
    return jsonify(treks_list)

@admin_bp.route('/treks', methods=['POST'])
@login_required
def create_trek():
    role_error = check_admin_role()
    if role_error:
        return role_error

    data = request.get_json() or {}
    name = data.get('name', '').strip()
    location = data.get('location', '').strip()
    difficulty = data.get('difficulty', 'Moderate').strip()
    duration = data.get('duration')
    total_slots = data.get('total_slots')
    start_date_str = data.get('start_date')
    end_date_str = data.get('end_date')
    assigned_staff_id = data.get('assigned_staff_id')
    status = data.get('status', 'Pending').strip()

    if not name or not location or not duration or not total_slots or not start_date_str or not end_date_str:
        return jsonify({'error': 'Missing required fields.'}), 400

    try:
        start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
        end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
        
        # Check duplicate trek name
        if Trek.query.filter_by(name=name).first():
            return jsonify({'error': 'A trek with this name already exists.'}), 400

        # Validate staff id if given
        if assigned_staff_id:
            staff = User.query.filter_by(id=assigned_staff_id, role='staff').first()
            if not staff:
                return jsonify({'error': 'Invalid staff ID.'}), 400

        trek = Trek(
            name=name,
            location=location,
            difficulty=difficulty,
            duration=int(duration),
            total_slots=int(total_slots),
            available_slots=int(total_slots),
            status=status,
            start_date=start_date,
            end_date=end_date,
            assigned_staff_id=assigned_staff_id if assigned_staff_id else None
        )
        db.session.add(trek)
        db.session.commit()
        cache.clear()

        return jsonify({'success': True, 'message': 'Trek created successfully.', 'trek_id': trek.id}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to create trek: {str(e)}'}), 500

@admin_bp.route('/treks/<int:trek_id>', methods=['PUT'])
@login_required
def update_trek(trek_id):
    role_error = check_admin_role()
    if role_error:
        return role_error

    trek = db.session.get(Trek, trek_id)
    if not trek:
        return jsonify({'error': 'Trek not found.'}), 404

    data = request.get_json() or {}
    try:
        if 'name' in data:
            dup = Trek.query.filter_by(name=data['name']).first()
            if dup and dup.id != trek.id:
                return jsonify({'error': 'Trek name already exists.'}), 400
            trek.name = data['name'].strip()
        
        if 'location' in data:
            trek.location = data['location'].strip()
        if 'difficulty' in data:
            trek.difficulty = data['difficulty'].strip()
        if 'duration' in data:
            trek.duration = int(data['duration'])
        
        if 'total_slots' in data:
            new_total = int(data['total_slots'])
            booked = trek.total_slots - trek.available_slots
            if new_total < booked:
                return jsonify({'error': f'Cannot reduce slots below the number of booked slots ({booked}).'}), 400
            trek.available_slots = new_total - booked
            trek.total_slots = new_total

        if 'status' in data:
            new_status = data['status'].strip()
            trek.status = new_status
            if new_status == 'Completed':
                Booking.query.filter_by(trek_id=trek.id, status='Booked').update({'status': 'Completed'})
        if 'start_date' in data:
            trek.start_date = datetime.strptime(data['start_date'], '%Y-%m-%d').date()
        if 'end_date' in data:
            trek.end_date = datetime.strptime(data['end_date'], '%Y-%m-%d').date()
        
        if 'assigned_staff_id' in data:
            staff_id = data['assigned_staff_id']
            if staff_id:
                staff = User.query.filter_by(id=staff_id, role='staff').first()
                if not staff:
                    return jsonify({'error': 'Invalid staff ID.'}), 400
                trek.assigned_staff_id = staff_id
            else:
                trek.assigned_staff_id = None

        db.session.commit()
        cache.clear()

        return jsonify({'success': True, 'message': 'Trek updated successfully.'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to update trek: {str(e)}'}), 500

@admin_bp.route('/treks/<int:trek_id>', methods=['DELETE'])
@login_required
def delete_trek(trek_id):
    role_error = check_admin_role()
    if role_error:
        return role_error

    trek = db.session.get(Trek, trek_id)
    if not trek:
        return jsonify({'error': 'Trek not found.'}), 404

    try:
        db.session.delete(trek)
        db.session.commit()
        cache.clear()
        return jsonify({'success': True, 'message': 'Trek deleted successfully.'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to delete trek: {str(e)}'}), 500

@admin_bp.route('/staff', methods=['POST'])
@login_required
def add_staff():
    role_error = check_admin_role()
    if role_error:
        return role_error

    data = request.get_json() or {}
    username = data.get('username', '').strip()
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')
    name = data.get('name', '').strip()
    contact = data.get('contact_details', '').strip()

    if not username or not email or not password or not name:
        return jsonify({'error': 'Username, email, password, and name are required.'}), 400

    if User.query.filter_by(username=username).first():
        return jsonify({'error': 'Username already exists.'}), 400
    if User.query.filter_by(email=email).first():
        return jsonify({'error': 'Email already exists.'}), 400

    try:
        user = User(
            username=username,
            email=email,
            password_hash=generate_password_hash(password),
            role='staff',
            status='approved'
        )
        db.session.add(user)
        db.session.flush()

        profile = StaffProfile(
            user_id=user.id,
            name=name,
            contact_details=contact
        )
        db.session.add(profile)
        db.session.commit()

        return jsonify({'success': True, 'message': 'Staff guide added successfully!'}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to add staff: {str(e)}'}), 500

@admin_bp.route('/staff', methods=['GET'])
@login_required
def get_staff_list():
    role_error = check_admin_role()
    if role_error:
        return role_error

    staff = User.query.filter_by(role='staff').all()
    staff_list = []
    for s in staff:
        staff_list.append({
            'id': s.id,
            'username': s.username,
            'email': s.email,
            'status': s.status,
            'name': s.staff_profile.name if s.staff_profile else 'No profile',
            'contact_details': s.staff_profile.contact_details if s.staff_profile else ''
        })
    return jsonify(staff_list)

@admin_bp.route('/users', methods=['GET'])
@login_required
def get_users_list():
    role_error = check_admin_role()
    if role_error:
        return role_error

    users = User.query.filter_by(role='trekker').all()
    users_list = []
    for u in users:
        users_list.append({
            'id': u.id,
            'username': u.username,
            'email': u.email,
            'status': u.status,
            'created_at': u.created_at.strftime('%Y-%m-%d %H:%M:%S')
        })
    return jsonify(users_list)

@admin_bp.route('/users/<int:user_id>/toggle-status', methods=['POST'])
@login_required
def toggle_user_status(user_id):
    role_error = check_admin_role()
    if role_error:
        return role_error

    user = db.session.get(User, user_id)
    if not user:
        return jsonify({'error': 'User not found.'}), 404

    if user.id == current_user.id:
        return jsonify({'error': 'Cannot change your own status.'}), 400

    data = request.get_json() or {}
    new_status = data.get('status', '').strip().lower()
    if new_status not in ['approved', 'blacklisted', 'pending']:
        return jsonify({'error': 'Invalid status. Must be approved, pending, or blacklisted.'}), 400

    user.status = new_status
    db.session.commit()
    return jsonify({'success': True, 'message': f"User status updated to {new_status}."}), 200

@admin_bp.route('/bookings', methods=['GET'])
@login_required
def get_all_bookings():
    role_error = check_admin_role()
    if role_error:
        return role_error

    bookings = Booking.query.order_by(Booking.booking_date.desc()).all()
    bookings_list = []
    for b in bookings:
        bookings_list.append({
            'id': b.id,
            'booking_date': b.booking_date.strftime('%Y-%m-%d %H:%M:%S'),
            'status': b.status,
            'user': {
                'id': b.trekker.id,
                'username': b.trekker.username,
                'email': b.trekker.email
            },
            'trek': {
                'id': b.trek.id,
                'name': b.trek.name,
                'location': b.trek.location
            }
        })
    return jsonify(bookings_list)

@admin_bp.route('/search', methods=['GET'])
@login_required
def search_system():
    role_error = check_admin_role()
    if role_error:
        return role_error

    q = request.args.get('q', '').strip()
    if not q:
        return jsonify({'treks': [], 'staff': [], 'users': []})

    # Search treks
    treks_q = Trek.query.filter(
        Trek.name.ilike(f"%{q}%") | Trek.location.ilike(f"%{q}%")
    ).all()
    
    # Search staff
    staff_q = User.query.filter_by(role='staff').join(StaffProfile).filter(
        User.username.ilike(f"%{q}%") | StaffProfile.name.ilike(f"%{q}%")
    ).all()

    # Search users (trekkers)
    users_q = User.query.filter_by(role='trekker').filter(
        User.username.ilike(f"%{q}%") | User.email.ilike(f"%{q}%")
    ).all()

    return jsonify({
        'treks': [{
            'id': t.id,
            'name': t.name,
            'location': t.location,
            'status': t.status
        } for t in treks_q],
        'staff': [{
            'id': s.id,
            'name': s.staff_profile.name if s.staff_profile else s.username,
            'status': s.status
        } for s in staff_q],
        'users': [{
            'id': u.id,
            'username': u.username,
            'status': u.status
        } for u in users_q]
    })
