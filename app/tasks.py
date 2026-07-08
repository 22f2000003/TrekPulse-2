from celery import shared_task
from app import db
from app.models import User, Trek, Booking, Notification
from datetime import datetime, date, timedelta
import os
import csv

@shared_task(name="app.tasks.send_daily_reminders")
def send_daily_reminders():
    """Daily reminder task - notifies users of upcoming treks in 24-48 hours."""
    today = date.today()
    tomorrow = today + timedelta(days=1)
    day_after = today + timedelta(days=2)
    
    # Query bookings for treks starting tomorrow or the day after
    upcoming_bookings = Booking.query.join(Trek).filter(
        Booking.status == 'Booked',
        Trek.start_date >= tomorrow,
        Trek.start_date <= day_after
    ).all()
    
    count = 0
    for b in upcoming_bookings:
        msg = f"Reminder: Your upcoming trek '{b.trek.name}' is starting on {b.trek.start_date.strftime('%Y-%m-%d')}. Location: {b.trek.location}. Please check your guide details."
        
        # 1. Create in-app notification
        noti = Notification(
            user_id=b.user_id,
            message=msg,
            type='reminder'
        )
        db.session.add(noti)
        
        # 2. Simulate email/g-chat/SMS log
        print(f"[DAILY REMINDER EMAIL] Sent to {b.trekker.email}: {msg}")
        count += 1
        
    db.session.commit()
    return f"Processed {count} daily reminders."

@shared_task(name="app.tasks.send_monthly_report")
def send_monthly_report():
    """Generates monthly report for Admin and simulates email delivery."""
    # Aggregated Stats
    total_treks = Trek.query.count()
    completed_treks = Trek.query.filter_by(status='Completed').count()
    total_bookings = Booking.query.filter_by(status='Booked').count()
    total_participants = User.query.filter_by(role='trekker').count()

    popular = db.session.query(
        Trek.name, db.func.count(Booking.id).label('booking_count')
    ).outerjoin(Booking).group_by(Trek.id).order_by(db.desc('booking_count')).limit(3).all()

    popular_html = "".join([f"<li>{name} ({count} bookings)</li>" for name, count in popular])

    report_html = f"""
    <html>
    <head>
        <style>
            body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
            .container {{ padding: 20px; border: 1px solid #ddd; max-width: 600px; border-radius: 8px; }}
            h2 {{ color: #0f766e; }}
            .stat-box {{ background: #f0fdfa; padding: 10px; margin: 10px 0; border-left: 4px solid #14b8a6; }}
        </style>
    </head>
    <body>
        <div class="container">
            <h2>Trekking Management System - Monthly Activity Report</h2>
            <p>Here is the activity summary for the past month:</p>
            <div class="stat-box">
                <strong>Total Treks Managed:</strong> {total_treks}<br>
                <strong>Completed Treks:</strong> {completed_treks}<br>
                <strong>Active User Bookings:</strong> {total_bookings}<br>
                <strong>Total Registered Trekkers:</strong> {total_participants}
            </div>
            <h3>Most Popular Trek Routes</h3>
            <ul>
                {popular_html}
            </ul>
            <p>Best regards,<br>TMA Automation System</p>
        </div>
    </body>
    </html>
    """

    # Simulate email to Admin
    admin = User.query.filter_by(role='admin').first()
    admin_email = admin.email if admin else "admin@trekking.com"
    print(f"[MONTHLY REPORT EMAIL] Sent to {admin_email}:\n{report_html}")
    
    # Save a log file locally for inspection
    log_dir = os.path.join(os.getcwd(), 'app', 'static', 'reports')
    os.makedirs(log_dir, exist_ok=True)
    report_file = os.path.join(log_dir, f"monthly_report_{datetime.now().strftime('%Y-%m')}.html")
    with open(report_file, 'w', encoding='utf-8') as f:
        f.write(report_html)

    return f"Monthly report generated and saved to {report_file}."

@shared_task(name="app.tasks.export_bookings_csv")
def export_bookings_csv(user_id):
    """Asynchronously export booking history for a specific user to a CSV file."""
    user = db.session.get(User, user_id)
    if not user:
        return f"User {user_id} not found."

    bookings = Booking.query.filter_by(user_id=user_id).all()
    
    # Create static export directory
    export_dir = os.path.join(os.getcwd(), 'app', 'static', 'exports')
    os.makedirs(export_dir, exist_ok=True)
    
    filename = f"bookings_{user_id}_{int(datetime.now().timestamp())}.csv"
    filepath = os.path.join(export_dir, filename)
    
    with open(filepath, mode='w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(['User ID', 'Trek Name', 'Location', 'Booking Status', 'Booking Date', 'Start Date', 'End Date'])
        for b in bookings:
            writer.writerow([
                user.id,
                b.trek.name,
                b.trek.location,
                b.status,
                b.booking_date.strftime('%Y-%m-%d'),
                b.trek.start_date.strftime('%Y-%m-%d'),
                b.trek.end_date.strftime('%Y-%m-%d')
            ])

    # Create user notification alert
    download_url = f"/static/exports/{filename}"
    msg = f"Your booking history export is ready. Click here to download."
    noti = Notification(
        user_id=user_id,
        message=msg,
        type='csv_export',
        link=download_url
    )
    db.session.add(noti)
    db.session.commit()
    
    return f"Successfully exported bookings to {filepath}."
