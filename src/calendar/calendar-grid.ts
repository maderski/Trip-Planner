import { getDaysInMonth, getFirstDayOfMonth, toDateString, isDateInRange } from '../shared/utils/dates.ts';

interface CalendarGridOptions {
  year: number;
  month: number;
  selectedDate: string | null;
  tripStart: string;
  tripEnd: string;
  eventDates: Set<string>;
  stayDates: Set<string>;
  restaurantDates: Set<string>;
  onDayClick: (date: string) => void;
}

export function renderCalendarGrid(container: HTMLElement, options: CalendarGridOptions): void {
  const { year, month, selectedDate, tripStart, tripEnd, eventDates, stayDates, restaurantDates, onDayClick } = options;
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const today = toDateString(new Date());

  const dows = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  let html = dows.map((d) => `<div class="calendar-dow">${d}</div>`).join('');

  for (let i = 0; i < firstDay; i++) {
    html += '<div class="calendar-day empty"></div>';
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const classes: string[] = ['calendar-day'];

    if (dateStr === today) classes.push('today');
    if (dateStr === selectedDate) classes.push('selected');
    if (tripStart && tripEnd && isDateInRange(dateStr, tripStart, tripEnd)) classes.push('in-range');
    const dots: string[] = [];
    if (stayDates.has(dateStr)) dots.push('<span class="day-icon day-icon--stay"></span>');
    if (restaurantDates.has(dateStr)) dots.push('<span class="day-icon day-icon--food"></span>');
    if (eventDates.has(dateStr)) dots.push('<span class="day-icon day-icon--event"></span>');
    const iconBar = dots.length ? `<div class="day-icon-bar">${dots.join('')}</div>` : '';

    html += `<div class="${classes.join(' ')}" data-date="${dateStr}">${day}${iconBar}</div>`;
  }

  container.innerHTML = html;

  container.querySelectorAll('.calendar-day:not(.empty)').forEach((el) => {
    el.addEventListener('click', () => {
      onDayClick((el as HTMLElement).dataset.date!);
    });
  });
}
