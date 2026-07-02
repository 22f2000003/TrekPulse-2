from flask import Blueprint, jsonify, request
from flask_login import login_required, current_user
from app import db, cache
from app.models import Trek, Booking, User

staff_bp = Blueprint('staff', __name__)

def check_staff_role():
    if current_user.role != 'staff':
        return jsonify({'error': 'Access denied. Staff only.'}), 403
    return None

@staff_bp.route('/treks', methods=['GET'])
@login_required
def get_assigned_treks():
    role_error = check_staff_role()
    if role_error:
        return role_error

    # Get treks assigned to current staff
    treks = Trek.query.filter_by(assigned_staff_id=current_user.id).all()
    treks_list = []
    for t in treks:
        # Count active bookings
        bookings_count = Booking.query.filter_by(trek_id=t.id, status='Booked').count()
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
            'bookings_count': bookings_count
        })
    return jsonify(treks_list)

@staff_bp.route('/treks/<int:trek_id>', methods=['PUT'])
@login_required
def update_assigned_trek(trek_id):
    role_error = check_staff_role()
    if role_error:
        return role_error

    trek = Trek.query.filter_by(id=trek_id, assigned_staff_id=current_user.id).first()
    if not trek:
        return jsonify({'error': 'Assigned trek not found.'}), 404

    data = request.get_json() or {}
    try:
        # Staff can manage available_slots and status (Open/Closed)
        if 'available_slots' in data:
            new_avail = int(data['available_slots'])
            booked = trek.total_slots - trek.available_slots
            
            # Checks
            if new_avail + booked > trek.total_slots:
                return jsonify({'error': f'Available slots cannot make total slots exceed {trek.total_slots}.'}), 400
            if new_avail < 0:
                return jsonify({'error': 'Available slots cannot be negative.'}), 400
            trek.available_slots = new_avail

        if 'status' in data:
            new_status = data['status'].strip()
            # Allowed transitions/states for staff: Open/Closed (cannot override completed directly unless marking as Completed)
            if new_status not in ['Open', 'Closed', 'Completed']:
                return jsonify({'error': 'Invalid status. Staff can set Open, Closed, or Completed.'}), 400
            trek.status = new_status
            if new_status == 'Completed':
                Booking.query.filter_by(trek_id=trek.id, status='Booked').update({'status': 'Completed'})
        db.session.commit()
        cache.clear()
        return jsonify({'success': True, 'message': 'Trek updated successfully by guide.'}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to update trek: {str(e)}'}), 500

@staff_bp.route('/treks/<int:trek_id>/participants', methods=['GET'])
@login_required
def get_participants(trek_id):
    role_error = check_staff_role()
    if role_error:
        return role_error

    trek = Trek.query.filter_by(id=trek_id, assigned_staff_id=current_user.id).first()
    if not trek:
        return jsonify({'error': 'Assigned trek not found.'}), 404

    # List of registered users
    bookings = Booking.query.filter_by(trek_id=trek_id, status='Booked').all()
    participants = []
    for b in bookings:
        participants.append({
            'booking_id': b.id,
            'booking_date': b.booking_date.strftime('%Y-%m-%d %H:%M:%S'),
            'user': {
                'id': b.trekker.id,
                'username': b.trekker.username,
                'email': b.trekker.email
            }
        })
    return jsonify(participants)

@staff_bp.route('/treks/<int:trek_id>/complete', methods=['POST'])
@login_required
def mark_completion(trek_id):
    role_error = check_staff_role()
    if role_error:
        return role_error

    trek = Trek.query.filter_by(id=trek_id, assigned_staff_id=current_user.id).first()
    if not trek:
        return jsonify({'error': 'Assigned trek not found.'}), 404

    data = request.get_json() or {}
    new_status = data.get('status', 'Completed').strip()
    if new_status not in ['Completed', 'Open', 'Closed']:
        return jsonify({'error': 'Invalid completion status.'}), 400

    try:
        trek.status = new_status
        if new_status == 'Completed':
            Booking.query.filter_by(trek_id=trek.id, status='Booked').update({'status': 'Completed'})
        db.session.commit()
        cache.clear()
        return jsonify({'success': True, 'message': f'Trek status marked as {new_status}.'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to update status: {str(e)}'}), 500
