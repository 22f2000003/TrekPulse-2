from flask import Blueprint, render_template, jsonify
from app.models import Trek, User, Booking
from app import db

main_bp = Blueprint('main', __name__)

@main_bp.route('/api/public/landing')
def public_landing():
    # Public stats (read-only, no sensitive info)
    total_treks = Trek.query.filter_by(status='Open').count()
    total_users = User.query.filter_by(role='trekker').count()
    
    # Popular treks (top 3)
    popular = db.session.query(
        Trek.name, db.func.count(Booking.id).label('booking_count')
    ).outerjoin(Booking).group_by(Trek.id).order_by(db.desc('booking_count')).limit(3).all()
    
    popular_treks = [{'name': name, 'count': count} for name, count in popular]
    
    # Available open treks
    treks = Trek.query.filter_by(status='Open').all()
    treks_list = []
    for t in treks:
        treks_list.append({
            'id': t.id,
            'name': t.name,
            'location': t.location,
            'difficulty': t.difficulty,
            'duration': t.duration,
            'available_slots': t.available_slots,
            'start_date': t.start_date.strftime('%Y-%m-%d'),
            'end_date': t.end_date.strftime('%Y-%m-%d')
        })
        
    return jsonify({
        'total_treks': total_treks,
        'total_users': total_users,
        'popular_treks': popular_treks,
        'treks': treks_list
    })

@main_bp.route('/')
@main_bp.route('/<path:path>')
def index(path=None):
    # Support client-side routing fallback if needed, serving index.html
    return render_template('index.html')

