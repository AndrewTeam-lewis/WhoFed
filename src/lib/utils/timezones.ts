export const commonTimezones = [
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'America/Anchorage',
    'America/Honolulu',
    'America/Sao_Paulo',
    'Europe/London',
    'Europe/Paris',
    'Europe/Berlin',
    'Africa/Cairo',
    'Asia/Dubai',
    'Asia/Kolkata',
    'Asia/Bangkok',
    'Asia/Singapore',
    'Asia/Tokyo',
    'Australia/Sydney',
    'Australia/Perth',
    'Pacific/Auckland'
];

export function getUserTimezone(): string {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York';
    } catch (e) {
        return 'America/New_York';
    }
}

export function getAllTimezones(): string[] {
    try {
        // Use modern Intl API for complete list if supported
        if (typeof Intl !== 'undefined' && (Intl as any).supportedValuesOf) {
            return (Intl as any).supportedValuesOf('timeZone');
        }
    } catch (e) {
        // Fallback
    }
    return commonTimezones;
}
