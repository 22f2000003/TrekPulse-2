from flask import Blueprint, jsonify, request
from flask_login import login_required, current_user
from app import db, cache
from app.models import Trek, Booking, User, Notification
from datetime import datetime

trekker_bp = Blueprint('trekker', __name__)

def check_trekker_role():
    if current_user.role != 'trekker':
        return jsonify({'error': 'Access denied. Trekkers only.'}), 403
    return None

@trekker_bp.route('/treks', methods=['GET'])
@login_required
@cache.cached(timeout=300, query_string=True)
def get_treks():
    role_error = check_trekker_role()
    if role_error:
        return role_error

    # Filters
    difficulty = request.args.get('difficulty', '').strip()
    location = request.args.get('location', '').strip()
    duration = request.args.get('duration', '').strip()
    search = request.args.get('search', '').strip()

    query = Trek.query.filter(Trek.status == 'Open')

    if difficulty:
        query = query.filter(Trek.difficulty.ilike(difficulty))
    if location:
        query = query.filter(Trek.location.ilike(f"%{location}%"))
    if duration:
        try:
            query = query.filter(Trek.duration <= int(duration))
        except ValueError:
            pass
    if search:
        query = query.filter(
            (Trek.name.ilike(f"%{search}%")) |
            (Trek.location.ilike(f"%{search}%"))
        )

    treks = query.all()
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
            'assigned_staff_name': t.assigned_staff.staff_profile.name if (t.assigned_staff and t.assigned_staff.staff_profile) else 'No guide assigned'
        })
    return jsonify(treks_list)


@trekker_bp.route('/bookings', methods=['POST'])
@login_required
def book_trek():
    role_error = check_trekker_role()
    if role_error:
        return role_error

    data = request.get_json() or {}
    trek_id = data.get('trek_id')

    if not trek_id:
        return jsonify({'error': 'Trek ID is required.'}), 400

    # Prevent overbooking & race conditions with SELECT FOR UPDATE
    try:
        # Fetch trek and lock row
        trek = db.session.query(Trek).filter_by(id=trek_id).with_for_update().first()

        if not trek:
            return jsonify({'error': 'Trek not found.'}), 444

        if trek.status != 'Open':
            return jsonify({'error': 'This trek is not open for booking.'}), 400

        # Prevent duplicate active bookings
        existing_booking = Booking.query.filter_by(
            user_id=current_user.id,
            trek_id=trek_id,
            status='Booked'
        ).first()

        if existing_booking:
            return jsonify({'error': 'You have already booked this trek.'}), 400

        if trek.available_slots <= 0:
            return jsonify({'error': 'No available slots left for this trek.'}), 400

        # Decrement slots and create booking
        trek.available_slots -= 1
        booking = Booking(
            user_id=current_user.id,
            trek_id=trek_id,
            status='Booked'
        )
        db.session.add(booking)
        db.session.commit()

        # Clear caching
        cache.clear()

        return jsonify({
            'success': True,
            'message': f'Successfully booked a slot on {trek.name}!',
            'booking_id': booking.id
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Booking failed: {str(e)}'}), 500


@trekker_bp.route('/bookings', methods=['GET'])
@login_required
def get_bookings():
    role_error = check_trekker_role()
    if role_error:
        return role_error

    bookings = Booking.query.filter_by(user_id=current_user.id).order_by(Booking.booking_date.desc()).all()
    bookings_list = []
    for b in bookings:
        bookings_list.append({
            'id': b.id,
            'booking_date': b.booking_date.strftime('%Y-%m-%d %H:%M:%S'),
            'status': b.status,
            'trek': {
                'id': b.trek.id,
                'name': b.trek.name,
                'location': b.trek.location,
                'difficulty': b.trek.difficulty,
                'duration': b.trek.duration,
                'start_date': b.trek.start_date.strftime('%Y-%m-%d'),
                'end_date': b.trek.end_date.strftime('%Y-%m-%d')
            }
        })
    return jsonify(bookings_list)


@trekker_bp.route('/bookings/<int:booking_id>/cancel', methods=['POST'])
@login_required
def cancel_booking(booking_id):
    role_error = check_trekker_role()
    if role_error:
        return role_error

    try:
        # Lock row for transaction consistency
        booking = db.session.query(Booking).filter_by(id=booking_id, user_id=current_user.id).first()

        if not booking:
            return jsonify({'error': 'Booking not found.'}), 404

        if booking.status == 'Cancelled':
            return jsonify({'error': 'Booking is already cancelled.'}), 400

        trek = db.session.query(Trek).filter_by(id=booking.trek_id).with_for_update().first()

        booking.status = 'Cancelled'
        if trek:
            trek.available_slots += 1

        db.session.commit()
        cache.clear()

        return jsonify({'success': True, 'message': 'Booking cancelled successfully.'}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Cancellation failed: {str(e)}'}), 500


@trekker_bp.route('/profile', methods=['PUT'])
@login_required
def update_profile():
    role_error = check_trekker_role()
    if role_error:
        return role_error

    data = request.get_json() or {}
    username = data.get('username', '').strip()
    email = data.get('email', '').strip().lower()

    if not username or not email:
        return jsonify({'error': 'Username and email are required.'}), 400

    # Duplicate checks
    dup_user = User.query.filter_by(username=username).first()
    if dup_user and dup_user.id != current_user.id:
        return jsonify({'error': 'Username is already taken.'}), 400

    dup_email = User.query.filter_by(email=email).first()
    if dup_email and dup_email.id != current_user.id:
        return jsonify({'error': 'Email is already taken.'}), 400

    try:
        current_user.username = username
        current_user.email = email
        db.session.commit()
        return jsonify({
            'success': True,
            'message': 'Profile updated successfully!',
            'user': {
                'id': current_user.id,
                'username': current_user.username,
                'email': current_user.email,
                'role': current_user.role
            }
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Update failed: {str(e)}'}), 500


@trekker_bp.route('/notifications', methods=['GET'])
@login_required
def get_notifications():
    notifications = Notification.query.filter_by(user_id=current_user.id).order_by(Notification.created_at.desc()).all()
    noti_list = []
    for n in notifications:
        noti_list.append({
            'id': n.id,
            'message': n.message,
            'type': n.type,
            'link': n.link,
            'is_read': n.is_read,
            'created_at': n.created_at.strftime('%Y-%m-%d %H:%M:%S')
        })
    return jsonify(noti_list)


@trekker_bp.route('/notifications/<int:noti_id>/read', methods=['POST'])
@login_required
def read_notification(noti_id):
    noti = Notification.query.filter_by(id=noti_id, user_id=current_user.id).first()
    if not noti:
        return jsonify({'error': 'Notification not found.'}), 404
    noti.is_read = True
    db.session.commit()
    return jsonify({'success': True}), 200


@trekker_bp.route('/export', methods=['POST'])
@login_required
def trigger_export():
    role_error = check_trekker_role()
    if role_error:
        return role_error

    from app.tasks import export_bookings_csv
    task = export_bookings_csv.delay(current_user.id)
    return jsonify({
        'success': True,
        'message': 'Booking history export started in background.',
        'task_id': task.id
    }), 202
