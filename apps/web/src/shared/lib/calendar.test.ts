import { describe, expect, it } from 'vitest';

import { generateGoogleCalendarLink, generateICS } from './calendar';

describe('calendar export helpers', () => {
  const event = {
    title: 'Swim Lessons',
    description: 'Bring goggles\nLane 4',
    location: 'Community Pool; West',
    start: new Date('2026-05-02T16:00:00.000Z'),
    end: new Date('2026-05-02T17:00:00.000Z'),
  };

  it('generates an ICS payload with escaped fields', () => {
    const ics = generateICS(event);

    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('SUMMARY:Swim Lessons');
    expect(ics).toContain('DESCRIPTION:Bring goggles\\nLane 4');
    expect(ics).toContain('LOCATION:Community Pool\\; West');
    expect(ics).toContain('DTSTART:20260502T160000Z');
    expect(ics).toContain('DTEND:20260502T170000Z');
  });

  it('generates a Google Calendar link with UTC date params', () => {
    const link = generateGoogleCalendarLink(event);

    expect(link).toContain('https://calendar.google.com/calendar/render?action=TEMPLATE');
    expect(link).toContain('text=Swim+Lessons');
    expect(link).toContain('details=Bring+goggles%0ALane+4');
    expect(link).toContain('location=Community+Pool%3B+West');
    expect(link).toContain('dates=20260502T160000Z%2F20260502T170000Z');
  });
});
