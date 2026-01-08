'use client';

/**
 * IDX (Indonesia Stock Exchange) Market Hours Utility
 * Based on official trading schedule
 *
 * Session Schedule:
 * - Pre-opening: 08:45 - 08:59
 * - Session I: Mon-Thu 09:00-12:00, Fri 09:00-11:30
 * - Lunch Break: Mon-Thu 12:00-13:30, Fri 11:30-14:00
 * - Session II: Mon-Thu 13:30-15:49, Fri 14:00-15:49
 * - Pre-closing: 15:50 - 16:01
 * - Post-closing: 16:02 - 16:30
 */

export type MarketSession =
  | 'pre_opening'
  | 'session_1'
  | 'lunch_break'
  | 'session_2'
  | 'pre_closing'
  | 'post_closing'
  | 'closed';

export interface MarketStatus {
  isOpen: boolean;
  session: MarketSession;
  label: string;
  nextOpenTime?: string;
}

/**
 * Check if a given time falls within a range
 */
function isTimeInRange(
  hours: number,
  minutes: number,
  startHour: number,
  startMin: number,
  endHour: number,
  endMin: number
): boolean {
  const current = hours * 60 + minutes;
  const start = startHour * 60 + startMin;
  const end = endHour * 60 + endMin;
  return current >= start && current < end;
}

/**
 * Get the current market session and status
 */
export function getMarketStatus(date: Date = new Date()): MarketStatus {
  const day = date.getDay(); // 0 = Sunday, 6 = Saturday
  const hours = date.getHours();
  const minutes = date.getMinutes();

  // Weekends - Market closed
  if (day === 0 || day === 6) {
    return {
      isOpen: false,
      session: 'closed',
      label: 'Pasar Tutup (Weekend)',
      nextOpenTime: 'Senin 09:00',
    };
  }

  const isFriday = day === 5;

  // Pre-opening: 08:45 - 08:59 (all days)
  if (isTimeInRange(hours, minutes, 8, 45, 9, 0)) {
    return {
      isOpen: true,
      session: 'pre_opening',
      label: 'Pra-pembukaan',
    };
  }

  // Session 1
  if (isFriday) {
    // Friday: 09:00 - 11:30
    if (isTimeInRange(hours, minutes, 9, 0, 11, 30)) {
      return {
        isOpen: true,
        session: 'session_1',
        label: 'Sesi I',
      };
    }
  } else {
    // Mon-Thu: 09:00 - 12:00
    if (isTimeInRange(hours, minutes, 9, 0, 12, 0)) {
      return {
        isOpen: true,
        session: 'session_1',
        label: 'Sesi I',
      };
    }
  }

  // Lunch break
  if (isFriday) {
    // Friday: 11:30 - 14:00
    if (isTimeInRange(hours, minutes, 11, 30, 14, 0)) {
      return {
        isOpen: false,
        session: 'lunch_break',
        label: 'Istirahat',
        nextOpenTime: '14:00',
      };
    }
  } else {
    // Mon-Thu: 12:00 - 13:30
    if (isTimeInRange(hours, minutes, 12, 0, 13, 30)) {
      return {
        isOpen: false,
        session: 'lunch_break',
        label: 'Istirahat',
        nextOpenTime: '13:30',
      };
    }
  }

  // Session 2
  if (isFriday) {
    // Friday: 14:00 - 15:50
    if (isTimeInRange(hours, minutes, 14, 0, 15, 50)) {
      return {
        isOpen: true,
        session: 'session_2',
        label: 'Sesi II',
      };
    }
  } else {
    // Mon-Thu: 13:30 - 15:50
    if (isTimeInRange(hours, minutes, 13, 30, 15, 50)) {
      return {
        isOpen: true,
        session: 'session_2',
        label: 'Sesi II',
      };
    }
  }

  // Pre-closing: 15:50 - 16:02 (all days)
  if (isTimeInRange(hours, minutes, 15, 50, 16, 2)) {
    return {
      isOpen: true,
      session: 'pre_closing',
      label: 'Pra-penutupan',
    };
  }

  // Post-closing: 16:02 - 16:30 (all days)
  if (isTimeInRange(hours, minutes, 16, 2, 16, 30)) {
    return {
      isOpen: true,
      session: 'post_closing',
      label: 'Pasca-penutupan',
    };
  }

  // Before market opens
  if (hours < 9) {
    return {
      isOpen: false,
      session: 'closed',
      label: 'Belum Buka',
      nextOpenTime: '09:00',
    };
  }

  // After market closes
  return {
    isOpen: false,
    session: 'closed',
    label: 'Pasar Tutup',
    nextOpenTime: 'Besok 09:00',
  };
}

/**
 * Simple check if market is currently open (any trading session)
 */
export function isMarketOpen(date: Date = new Date()): boolean {
  return getMarketStatus(date).isOpen;
}

/**
 * Check if we're in active trading session (Session 1 or 2, not pre/post)
 */
export function isActiveTradingSession(date: Date = new Date()): boolean {
  const status = getMarketStatus(date);
  return status.session === 'session_1' || status.session === 'session_2';
}
