import { useState } from 'react';

export default function SimpleCalendar() {
  const [currentDate] = useState(new Date());

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days: (number | null)[] = [];
    
    // Add empty slots for days before the first of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add the days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }
    
    return days;
  };

  const isToday = (day: number | null) => {
    if (!day) return false;
    const today = new Date();
    return (
      day === today.getDate() &&
      currentDate.getMonth() === today.getMonth() &&
      currentDate.getFullYear() === today.getFullYear()
    );
  };

  const days = getDaysInMonth(currentDate);

  return (
    <div className="simple-calendar">
      <div className="calendar-header mb-3 text-center">
        <h6 className="mb-2 fw-bold">
          {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
        </h6>
      </div>
      
      <div className="calendar-grid">
        {dayNames.map((day) => (
          <div key={day} className="calendar-day-header">
            {day}
          </div>
        ))}
        
        {days.map((day, index) => (
          <div
            key={index}
            className={`calendar-day ${day ? '' : 'empty'} ${isToday(day) ? 'today' : ''}`}
          >
            {day || ''}
          </div>
        ))}
      </div>

      <style>{`
        .simple-calendar {
          padding: 15px;
        }

        .calendar-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 1px;
          background: #e2e8f0;
          border-radius: 8px;
          overflow: hidden;
        }

        .calendar-day-header {
          background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%);
          color: white;
          padding: 8px 4px;
          text-align: center;
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
        }

        .calendar-day {
          background: white;
          padding: 8px 4px;
          text-align: center;
          min-height: 35px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 500;
          color: #1a1a1a;
          font-size: 11px;
        }

        .calendar-day.empty {
          background: #f8f9fa;
        }

        .calendar-day.today {
          background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%);
          color: white;
          font-weight: 700;
        }
      `}</style>
    </div>
  );
}














