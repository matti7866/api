import React, { useState, useEffect } from 'react';
import { calendarService } from '../../services/calendarService';
import type { Cheque, Flight, CustomEvent, CalendarEvent } from '../../types/calendar';
import Swal from 'sweetalert2';
import storage from '../../utils/storage';
import config from '../../utils/config';

export const EnhancedCalendar: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const today = new Date();

  useEffect(() => {
    loadAllEvents();
  }, []);

  const loadAllEvents = async () => {
    try {
      setLoading(true);
      const [cheques, flights, customEvents] = await Promise.all([
        calendarService.getCheques().catch(() => []),
        calendarService.getFlights().catch(() => []),
        calendarService.getCustomEvents().catch(() => []),
      ]);

      const allEvents: CalendarEvent[] = [];

      // Add cheque events
      cheques.forEach((cheque) => {
        allEvents.push({
          date: new Date(cheque.date).toDateString(),
          title: `Cheque: ${cheque.payee} - د.إ${Number(cheque.amount).toLocaleString()}`,
          type: 'cheque',
          details: cheque,
        });
      });

      // Add flight events
      flights.forEach((flight) => {
        try {
          // Parse the date format "October, 15 2025"
          const cleanDate = flight.date_of_travel.replace(',', '');
          const flightDate = new Date(cleanDate);
          if (!isNaN(flightDate.getTime())) {
            allEvents.push({
              date: flightDate.toDateString(),
              title: `Flight: ${flight.from_place} → ${flight.to_place} (${flight.Pnr})`,
              type: 'flight',
              details: flight,
            });
          }
        } catch (e) {
          console.log('Date parsing error for flight:', flight.date_of_travel);
        }
      });

      // Add custom events
      customEvents.forEach((event) => {
        allEvents.push({
          date: new Date(event.date).toDateString(),
          title: event.title,
          type: 'custom',
          details: event,
        });
      });

      console.log(`Loaded ${allEvents.length} total events`);
      setEvents(allEvents);
    } catch (error) {
      console.error('Error loading calendar events:', error);
    } finally {
      setLoading(false);
    }
  };

  const getMonthName = (month: number): string => {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[month];
  };

  const isSameDay = (date1: Date, date2: Date): boolean => {
    return date1.toDateString() === date2.toDateString();
  };

  const getEventInfo = (date: Date) => {
    const dateString = date.toDateString();
    const dayEvents = events.filter(event => event.date === dateString);
    
    return {
      hasEvent: dayEvents.length > 0,
      hasCheque: dayEvents.some(event => event.type === 'cheque'),
      hasFlight: dayEvents.some(event => event.type === 'flight'),
      hasCustomEvent: dayEvents.some(event => event.type === 'custom'),
      events: dayEvents,
    };
  };

  const handleDateClick = (date: Date) => {
    const eventInfo = getEventInfo(date);
    const formattedDate = date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    
    if (eventInfo.events.length > 0) {
      // Show events with option to add new event
      let eventDetails = '<div style="text-align: left;">';
      
      eventInfo.events.forEach(event => {
        let icon = '';
        let color = '';
        
        switch(event.type) {
          case 'cheque':
            const cheque = event.details as Cheque;
            icon = '💰';
            color = cheque.type === 'payable' ? '#dc2626' : '#10b981';
            eventDetails += `
              <div style="margin-bottom: 15px; padding: 10px; border-left: 4px solid ${color}; background: rgba(248, 249, 250, 0.5);">
                <strong>${icon} ${event.title}</strong><br>
                <small>Cheque #${cheque.number} - ${cheque.type}</small>
              </div>`;
            break;
            
          case 'flight':
            const flight = event.details as Flight;
            icon = '✈️';
            color = '#3b82f6';
            eventDetails += `
              <div style="margin-bottom: 15px; padding: 10px; border-left: 4px solid ${color}; background: rgba(59, 130, 246, 0.1);">
                <strong>${icon} ${event.title}</strong><br>
                <small>Customer: ${flight.customer_name}<br>
                Passenger: ${flight.passenger_name}<br>
                Departure: ${flight.date_of_travel}</small>
              </div>`;
            break;
            
          case 'custom':
            const customEvent = event.details as CustomEvent;
            switch(customEvent.subtype) {
              case 'meeting':
                icon = '👥';
                color = '#8b5cf6';
                break;
              case 'deadline':
                icon = '⏰';
                color = '#ef4444';
                break;
              case 'task':
                icon = '✅';
                color = '#10b981';
                break;
              case 'appointment':
                icon = '📅';
                color = '#f59e0b';
                break;
              default:
                icon = '📌';
                color = customEvent.color || '#6b7280';
            }
            eventDetails += `
              <div style="margin-bottom: 15px; padding: 10px; border-left: 4px solid ${color}; background: rgba(107, 114, 128, 0.1);">
                <strong>${icon} ${event.title}</strong><br>
                <small>${customEvent.description || ''}<br>
                ${customEvent.time ? `Time: ${customEvent.time}` : 'All Day'}<br>
                Priority: ${customEvent.priority}</small>
              </div>`;
            break;
        }
      });
      
      eventDetails += '</div>';
      
      Swal.fire({
        title: formattedDate,
        html: eventDetails,
        icon: 'info',
        showCancelButton: true,
        confirmButtonText: '<i class="fas fa-plus me-1"></i> Add New Event',
        cancelButtonText: 'Close',
        confirmButtonColor: '#dc2626',
        cancelButtonColor: '#6b7280',
      }).then((result) => {
        if (result.isConfirmed) {
          showAddEventForm(date);
        }
      });
    } else {
      // No events, show add event option
      Swal.fire({
        title: formattedDate,
        text: 'No events scheduled for this day.',
        icon: 'info',
        showCancelButton: true,
        confirmButtonText: '<i class="fas fa-plus me-1"></i> Add Event',
        cancelButtonText: 'Close',
        confirmButtonColor: '#dc2626',
        cancelButtonColor: '#6b7280',
      }).then((result) => {
        if (result.isConfirmed) {
          showAddEventForm(date);
        }
      });
    }
  };

  const showAddEventForm = async (date: Date) => {
    const dateString = date.toISOString().split('T')[0];
    
    const { value: formValues } = await Swal.fire({
      title: 'Add New Event',
      html: `
        <div style="text-align: left;">
          <div style="margin-bottom: 15px;">
            <label style="display: block; margin-bottom: 5px; font-weight: 600;">Event Title *</label>
            <input id="event-title" class="swal2-input" placeholder="Enter event title" style="width: 100%; margin: 0;">
          </div>
          
          <div style="margin-bottom: 15px;">
            <label style="display: block; margin-bottom: 5px; font-weight: 600;">Description</label>
            <textarea id="event-description" class="swal2-textarea" placeholder="Event description" style="width: 100%; margin: 0;"></textarea>
          </div>
          
          <div style="margin-bottom: 15px;">
            <label style="display: block; margin-bottom: 5px; font-weight: 600;">Date *</label>
            <input id="event-date" type="date" class="swal2-input" value="${dateString}" style="width: 100%; margin: 0;">
          </div>
          
          <div style="margin-bottom: 15px;">
            <label style="display: block; margin-bottom: 5px; font-weight: 600;">Time</label>
            <input id="event-time" type="time" class="swal2-input" style="width: 100%; margin: 0;">
          </div>
          
          <div style="margin-bottom: 15px;">
            <label style="display: block; margin-bottom: 5px; font-weight: 600;">Event Type *</label>
            <select id="event-type" class="swal2-select" style="width: 100%; margin: 0;">
              <option value="general">General</option>
              <option value="meeting">Meeting</option>
              <option value="deadline">Deadline</option>
              <option value="task">Task</option>
              <option value="appointment">Appointment</option>
              <option value="reminder">Reminder</option>
            </select>
          </div>
          
          <div style="margin-bottom: 15px;">
            <label style="display: block; margin-bottom: 5px; font-weight: 600;">Priority *</label>
            <select id="event-priority" class="swal2-select" style="width: 100%; margin: 0;">
              <option value="low">Low</option>
              <option value="medium" selected>Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          
          <div style="margin-bottom: 15px;">
            <label style="display: block; margin-bottom: 5px; font-weight: 600;">Color</label>
            <input id="event-color" type="color" value="#dc2626" class="swal2-input" style="width: 100%; margin: 0; height: 50px;">
          </div>
        </div>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: '<i class="fas fa-save me-1"></i> Save Event',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      width: '600px',
      preConfirm: () => {
        const title = (document.getElementById('event-title') as HTMLInputElement).value;
        const description = (document.getElementById('event-description') as HTMLTextAreaElement).value;
        const eventDate = (document.getElementById('event-date') as HTMLInputElement).value;
        const time = (document.getElementById('event-time') as HTMLInputElement).value;
        const type = (document.getElementById('event-type') as HTMLSelectElement).value;
        const priority = (document.getElementById('event-priority') as HTMLSelectElement).value;
        const color = (document.getElementById('event-color') as HTMLInputElement).value;
        
        if (!title || !eventDate) {
          Swal.showValidationMessage('Please fill in all required fields (Title and Date)');
          return false;
        }
        
        return { title, description, eventDate, time, type, priority, color };
      }
    });

    if (formValues) {
      await saveEvent(formValues);
    }
  };

  const saveEvent = async (eventData: any) => {
    try {
      Swal.fire({
        title: 'Saving Event...',
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });

      // Call the old PHP endpoint for backward compatibility
      const formData = new FormData();
      formData.append('action', 'add_event');
      formData.append('title', eventData.title);
      formData.append('description', eventData.description || '');
      formData.append('event_date', eventData.eventDate);
      formData.append('event_time', eventData.time || '');
      formData.append('event_type', eventData.type);
      formData.append('priority', eventData.priority);
      formData.append('color', eventData.color);

      // Get JWT token for authorization
      const token = storage.get<string>(config.tokenKey);
      const headers: HeadersInit = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${config.baseUrl}/calendarController.php`, {
        method: 'POST',
        body: formData,
        headers,
      });

      const result = await response.json();

      if (result.status === 'success') {
        Swal.fire({
          icon: 'success',
          title: 'Event Added!',
          text: 'The event has been successfully added to the calendar.',
          confirmButtonColor: '#dc2626',
        });
        
        // Reload events
        loadAllEvents();
      } else {
        throw new Error(result.message || 'Failed to save event');
      }
    } catch (error: any) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.message || 'Failed to save event. Please try again.',
        confirmButtonColor: '#dc2626',
      });
    }
  };

  const renderDays = (): JSX.Element[] => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    const days: JSX.Element[] = [];
    let currentIterDate = new Date(startDate);
    
    for (let i = 0; i < 42; i++) {
      const isCurrentMonth = currentIterDate.getMonth() === month;
      const isToday = isSameDay(currentIterDate, today);
      const eventInfo = getEventInfo(currentIterDate);
      
      let classes = 'calendar-day';
      if (!isCurrentMonth) classes += ' other-month';
      if (isToday) classes += ' today';
      if (eventInfo.hasEvent) {
        classes += ' has-event';
        if (eventInfo.hasCheque) classes += ' has-cheque-event';
        if (eventInfo.hasFlight) classes += ' has-flight-event';
        if (eventInfo.hasCustomEvent) classes += ' has-custom-event';
      }
      
      const dayDate = new Date(currentIterDate);
      days.push(
        <div
          key={i}
          className={classes}
          onClick={() => handleDateClick(dayDate)}
          style={{ cursor: 'pointer' }}
        >
          {currentIterDate.getDate()}
        </div>
      );
      
      currentIterDate.setDate(currentIterDate.getDate() + 1);
    }
    
    return days;
  };

  const getUpcomingEvents = (): CalendarEvent[] => {
    const today = new Date();
    const futureEvents = events.filter(event => {
      const eventDate = new Date(event.date);
      return eventDate >= today;
    });
    
    // Sort by date
    futureEvents.sort((a, b) => {
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });
    
    // Return first 10
    return futureEvents.slice(0, 10);
  };

  const formatEventDate = (dateString: string): string => {
    const eventDate = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (isSameDay(eventDate, today)) {
      return 'Today';
    } else if (isSameDay(eventDate, tomorrow)) {
      return 'Tomorrow';
    } else {
      return eventDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  return (
    <div className="card dashboard-card">
      <div className="card-header">
        <h5 className="mb-0">
          <i className="fas fa-calendar-alt me-2"></i>
          Calendar Overview
        </h5>
      </div>
      <div className="card-body p-0">
        <div className="modern-calendar">
          {loading ? (
            <div className="text-center py-5">
              <i className="fas fa-spinner fa-spin fa-2x mb-3" style={{ color: '#dc2626' }}></i>
              <p>Loading calendar...</p>
            </div>
          ) : (
            <>
              <div className="calendar-header">
                <button className="calendar-nav-btn" onClick={previousMonth}>
                  <i className="fas fa-chevron-left"></i>
                </button>
                <h3 className="calendar-title">
                  {getMonthName(currentDate.getMonth())} {currentDate.getFullYear()}
                </h3>
                <button className="calendar-nav-btn" onClick={nextMonth}>
                  <i className="fas fa-chevron-right"></i>
                </button>
              </div>
              <div className="calendar-grid">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                  <div key={day} className="calendar-day-header">{day}</div>
                ))}
                {renderDays()}
              </div>
            </>
          )}
        </div>
        <div className="calendar-events">
          <h6 className="mb-2 text-red">
            <i className="fas fa-list me-2"></i>
            Upcoming Events
          </h6>
          <div className="upcoming-events">
            {getUpcomingEvents().length > 0 ? (
              getUpcomingEvents().map((event, index) => {
                let eventClass = 'event-item';
                if (event.type === 'cheque') eventClass += ' cheque-event';
                if (event.type === 'flight') eventClass += ' flight-event';
                if (event.type === 'custom') eventClass += ' custom-event';
                
                return (
                  <div key={index} className={eventClass}>
                    <div>
                      <span className="event-date">{formatEventDate(event.date)}</span>
                      <div className="event-title">{event.title}</div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center text-muted py-3">
                <i className="fas fa-calendar-check fa-2x mb-2"></i>
                <p className="mb-0">No upcoming events</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnhancedCalendar;

