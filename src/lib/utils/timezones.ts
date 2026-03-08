export interface TimezoneOption {
    label: string;
    value: string;
}

export const curatedTimezones: TimezoneOption[] = [
    { value: 'Pacific/Midway', label: '(GMT-11:00) Midway Island, Samoa' },
    { value: 'Pacific/Honolulu', label: '(GMT-10:00) Hawaii' },
    { value: 'America/Anchorage', label: '(GMT-09:00) Alaska' },
    { value: 'America/Los_Angeles', label: '(GMT-08:00) Pacific Time (US & Canada)' },
    { value: 'America/Phoenix', label: '(GMT-07:00) Arizona' },
    { value: 'America/Denver', label: '(GMT-07:00) Mountain Time (US & Canada)' },
    { value: 'America/Chicago', label: '(GMT-06:00) Central Time (US & Canada)' },
    { value: 'America/Mexico_City', label: '(GMT-06:00) Mexico City' },
    { value: 'America/New_York', label: '(GMT-05:00) Eastern Time (US & Canada)' },
    { value: 'America/Bogota', label: '(GMT-05:00) Bogota, Lima, Quito' },
    { value: 'America/Caracas', label: '(GMT-04:00) Caracas, La Paz' },
    { value: 'America/Halifax', label: '(GMT-04:00) Atlantic Time (Canada)' },
    { value: 'America/St_Johns', label: '(GMT-03:30) Newfoundland' },
    { value: 'America/Argentina/Buenos_Aires', label: '(GMT-03:00) Buenos Aires' },
    { value: 'America/Sao_Paulo', label: '(GMT-03:00) Brasilia' },
    { value: 'Atlantic/Azores', label: '(GMT-01:00) Azores' },
    { value: 'Europe/London', label: '(GMT+00:00) London, Edinburgh, Dublin, Lisbon' },
    { value: 'UTC', label: '(GMT+00:00) Universal Time Coordinated' },
    { value: 'Europe/Berlin', label: '(GMT+01:00) Amsterdam, Berlin, Bern, Rome, Stockholm' },
    { value: 'Europe/Paris', label: '(GMT+01:00) Brussels, Copenhagen, Madrid, Paris' },
    { value: 'Africa/Lagos', label: '(GMT+01:00) West Central Africa' },
    { value: 'Europe/Kyiv', label: '(GMT+02:00) Kyiv, Athens, Bucharest, Istanbul' },
    { value: 'Africa/Cairo', label: '(GMT+02:00) Cairo' },
    { value: 'Africa/Johannesburg', label: '(GMT+02:00) Harare, Pretoria' },
    { value: 'Europe/Moscow', label: '(GMT+03:00) Moscow, St. Petersburg, Volgograd' },
    { value: 'Asia/Riyadh', label: '(GMT+03:00) Kuwait, Riyadh' },
    { value: 'Asia/Dubai', label: '(GMT+04:00) Abu Dhabi, Muscat' },
    { value: 'Asia/Kabul', label: '(GMT+04:30) Kabul' },
    { value: 'Asia/Karachi', label: '(GMT+05:00) Islamabad, Karachi, Tashkent' },
    { value: 'Asia/Kolkata', label: '(GMT+05:30) Chennai, Kolkata, Mumbai, New Delhi' },
    { value: 'Asia/Kathmandu', label: '(GMT+05:45) Kathmandu' },
    { value: 'Asia/Dhaka', label: '(GMT+06:00) Astana, Dhaka' },
    { value: 'Asia/Rangoon', label: '(GMT+06:30) Yangon (Rangoon)' },
    { value: 'Asia/Bangkok', label: '(GMT+07:00) Bangkok, Hanoi, Jakarta' },
    { value: 'Asia/Singapore', label: '(GMT+08:00) Beijing, Chongqing, Hong Kong, Urumqi' },
    { value: 'Asia/Tokyo', label: '(GMT+09:00) Osaka, Sapporo, Tokyo' },
    { value: 'Asia/Seoul', label: '(GMT+09:00) Seoul' },
    { value: 'Australia/Adelaide', label: '(GMT+09:30) Adelaide' },
    { value: 'Australia/Sydney', label: '(GMT+10:00) Canberra, Melbourne, Sydney' },
    { value: 'Australia/Brisbane', label: '(GMT+10:00) Brisbane' },
    { value: 'Pacific/Noumea', label: '(GMT+11:00) Magadan, Solomon Is., New Caledonia' },
    { value: 'Pacific/Auckland', label: '(GMT+12:00) Auckland, Wellington' },
    { value: 'Pacific/Fiji', label: '(GMT+12:00) Fiji, Kamchatka, Marshall Is.' },
    { value: 'Pacific/Tongatapu', label: '(GMT+13:00) Nuku\'alofa' }
];

export function getUserTimezone(): string {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York';
    } catch (e) {
        return 'America/New_York';
    }
}

export function getAllTimezones(): TimezoneOption[] {
    return curatedTimezones;
}
