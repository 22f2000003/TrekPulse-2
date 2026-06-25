import click
from flask.cli import with_appcontext
from app import db
from app.models import User, StaffProfile, Trek, Booking
from werkzeug.security import generate_password_hash
from datetime import date, timedelta, datetime

@click.command("seed-db")
@with_appcontext
def seed_db_command():
    """Seed default admin user and initial sample data matching the wireframe."""
    db.drop_all()  # Fresh start for seeding
    db.create_all()

    # 1. Seed Admin
    admin = User(
        username='admin',
        email='admin@trekking.com',
        password_hash=generate_password_hash('admin123'),
        role='admin',
        status='approved'
    )
    db.session.add(admin)
    click.echo("Admin user seeded successfully (admin@trekking.com / admin123)")
    
    # 2. Seed Staff Guides
    guides_data = [
        {'username': 'vikas_guide', 'email': 'vikas@mail.com', 'name': 'Vikas Singh', 'contact': '9876543210', 'status': 'approved'},
        {'username': 'neha_guide', 'email': 'neha@mail.com', 'name': 'Neha Joshi', 'contact': '9123456780', 'status': 'pending'},
        {'username': 'arjun_guide', 'email': 'arjun@mail.com', 'name': 'Arjun Mehta', 'contact': '9988776655', 'status': 'blacklisted'}
    ]
    
    staff_lookup = {}
    for gd in guides_data:
        user = User(
            username=gd['username'],
            email=gd['email'],
            password_hash=generate_password_hash('Password123!'),
            role='staff',
            status=gd['status']
        )
        db.session.add(user)
        db.session.flush() # get ID
        
        profile = StaffProfile(
            user_id=user.id,
            name=gd['name'],
            contact_details=gd['contact']
        )
        db.session.add(profile)
        click.echo(f"Seeding Staff Guide: {gd['name']} ({gd['status']})")
        staff_lookup[gd['email']] = user

    # 3. Seed Trekkers
    trekkers_data = [
        {'username': 'Amit Sharma', 'email': 'amit@mail.com', 'status': 'approved'},
        {'username': 'Priya Patel', 'email': 'priya@mail.com', 'status': 'approved'},
        {'username': 'Rahul Verma', 'email': 'rahul@mail.com', 'status': 'blacklisted'}
    ]
    
    trekker_lookup = {}
    for td in trekkers_data:
        user = User(
            username=td['username'],
            email=td['email'],
            password_hash=generate_password_hash('Password123!'),
            role='trekker',
            status=td['status']
        )
        db.session.add(user)
        click.echo(f"Seeding Trekker: {td['username']} ({td['status']})")
        trekker_lookup[td['username']] = user

    db.session.commit()

    # 4. Seed Treks (assigned to Vikas Singh)
    vikas = staff_lookup['vikas@mail.com']
    
    treks_data = [
        {
            'name': 'Everest Base Camp',
            'location': 'Nepal',
            'difficulty': 'Hard',
            'duration': 12,
            'total_slots': 20,
            'available_slots': 18,
            'status': 'Open',
            'start_days_offset': 10,
            'end_days_offset': 22
        },
        {
            'name': 'Roopkund Trek',
            'location': 'Uttarakhand',
            'difficulty': 'Moderate',
            'duration': 7,
            'total_slots': 15,
            'available_slots': 14,
            'status': 'Open',
            'start_days_offset': 15,
            'end_days_offset': 22
        },
        {
            'name': 'Kedarkantha Trek',
            'location': 'Uttarakhand',
            'difficulty': 'Easy',
            'duration': 5,
            'total_slots': 20,
            'available_slots': 20,
            'status': 'Closed',
            'start_days_offset': -10,
            'end_days_offset': -5
        },
        {
            'name': 'Hampta Pass',
            'location': 'Himachal',
            'difficulty': 'Moderate',
            'duration': 8,
            'total_slots': 12,
            'available_slots': 12,
            'status': 'Open',
            'start_days_offset': 25,
            'end_days_offset': 33
        }
    ]
    
    today = date.today()
    trek_lookup = {}
    for td in treks_data:
        trek = Trek(
            name=td['name'],
            location=td['location'],
            difficulty=td['difficulty'],
            duration=td['duration'],
            total_slots=td['total_slots'],
            available_slots=td['available_slots'],
            status=td['status'],
            start_date=today + timedelta(days=td['start_days_offset']),
            end_date=today + timedelta(days=td['end_days_offset']),
            assigned_staff_id=vikas.id
        )
        db.session.add(trek)
        click.echo(f"Seeding Trek: {td['name']}")
        trek_lookup[td['name']] = trek

    db.session.commit()

    # 5. Seed Bookings
    amit = trekker_lookup['Amit Sharma']
    priya = trekker_lookup['Priya Patel']
    rahul = trekker_lookup['Rahul Verma']
    
    ebc = trek_lookup['Everest Base Camp']
    roopkund = trek_lookup['Roopkund Trek']
    kedarkantha = trek_lookup['Kedarkantha Trek']
    
    bookings_data = [
        {'user': amit, 'trek': ebc, 'status': 'Booked', 'days_offset': -2},
        {'user': priya, 'trek': ebc, 'status': 'Booked', 'days_offset': -1},
        {'user': amit, 'trek': roopkund, 'status': 'Booked', 'days_offset': -3},
        {'user': rahul, 'trek': kedarkantha, 'status': 'Cancelled', 'days_offset': -12}
    ]
    
    for bd in bookings_data:
        booking = Booking(
            user_id=bd['user'].id,
            trek_id=bd['trek'].id,
            booking_date=datetime.now() + timedelta(days=bd['days_offset']),
            status=bd['status']
        )
        db.session.add(booking)
        click.echo(f"Seeding Booking: {bd['user'].username} for {bd['trek'].name} ({bd['status']})")
        
    db.session.commit()
    click.echo("Seeding process completed successfully!")
