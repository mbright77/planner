export type CalendarEvent = {
  title: string;
  description?: string;
  location?: string;
  start: Date;
  end: Date;
};

function ensureValidDate(date: Date, label: string) {
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid ${label} date.`);
  }
}

function validateEvent(event: CalendarEvent) {
  ensureValidDate(event.start, 'start');
  ensureValidDate(event.end, 'end');

  if (event.end <= event.start) {
    throw new Error('Event end date must be after start date.');
  }
}

function formatUtcDate(date: Date) {
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
}

function escapeICSValue(value: string | undefined) {
  if (!value) {
    return '';
  }

  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r\n/g, '\\n')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function buildUID(event: CalendarEvent) {
  const normalizedTitle = event.title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'event';

  return `${formatUtcDate(event.start)}-${normalizedTitle}@planner`;
}

function sanitizeFilename(title: string) {
  const normalizedTitle = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return `${normalizedTitle || 'calendar-event'}.ics`;
}

function isIOSDevice() {
  if (typeof navigator === 'undefined') {
    return false;
  }

  const userAgent = navigator.userAgent || '';
  const isAppleMobile = /iPad|iPhone|iPod/.test(userAgent);
  const isIPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;

  return isAppleMobile || isIPadOS;
}

export function generateICS(event: CalendarEvent) {
  validateEvent(event);

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Family Planner//Calendar Export//EN',
    'BEGIN:VEVENT',
    `UID:${buildUID(event)}`,
    `DTSTAMP:${formatUtcDate(new Date())}`,
    `DTSTART:${formatUtcDate(event.start)}`,
    `DTEND:${formatUtcDate(event.end)}`,
    `SUMMARY:${escapeICSValue(event.title)}`,
    `DESCRIPTION:${escapeICSValue(event.description)}`,
    `LOCATION:${escapeICSValue(event.location)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

export function generateGoogleCalendarLink(event: CalendarEvent) {
  validateEvent(event);

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    details: event.description ?? '',
    location: event.location ?? '',
    dates: `${formatUtcDate(event.start)}/${formatUtcDate(event.end)}`,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function downloadICS(event: CalendarEvent) {
  try {
    if (typeof document === 'undefined' || typeof URL === 'undefined') {
      return false;
    }

    const ics = generateICS(event);
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = sanitizeFilename(event.title);
    link.rel = 'noopener';
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    return true;
  } catch {
    return false;
  }
}

export function addToCalendar(event: CalendarEvent) {
  try {
    if (isIOSDevice()) {
      return downloadICS(event);
    }

    if (typeof window === 'undefined') {
      return false;
    }

    window.open(generateGoogleCalendarLink(event), '_blank', 'noopener,noreferrer');
    return true;
  } catch {
    return false;
  }
}
