import type { Database } from './database.types';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

type Schedule = Database['public']['Tables']['schedules']['Row'];
type DailyTaskInsert = Database['public']['Tables']['daily_tasks']['Insert'];

export function generateTasksForDate(
    schedules: Schedule[],
    date: Date,
    householdId: string,
    householdTimezone: string = 'America/New_York'
): DailyTaskInsert[] {
    const tasks: DailyTaskInsert[] = [];

    // Evaluate "today" in the household's timezone
    const zonedDate = toZonedTime(date, householdTimezone);

    const year = zonedDate.getFullYear();
    const month = String(zonedDate.getMonth() + 1).padStart(2, '0');
    const dayNum = String(zonedDate.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${dayNum}`;

    const dayOfWeek = zonedDate.getDay(); // 0 = Sun
    const dayOfMonth = zonedDate.getDate(); // 1-31

    schedules.forEach(schedule => {
        if (!schedule.is_enabled) return;
        if (!schedule.target_times || schedule.target_times.length === 0) return;

        let activeTimes: { time: string }[] = [];

        schedule.target_times.forEach(encodedString => {
            const parts = encodedString.split(':');

            if (parts.length >= 3) {
                // Encoded format
                const prefix = parts[0];

                if (prefix === 'W') {
                    // Weekly: W:Day:HH:MM
                    const sDay = parseInt(parts[1]);
                    const time = `${parts[2]}:${parts[3]}`;
                    if (sDay === dayOfWeek) activeTimes.push({ time });
                } else if (prefix === 'M') {
                    // Monthly: M:Day:HH:MM
                    const sDay = parseInt(parts[1]);
                    const time = `${parts[2]}:${parts[3]}`;
                    if (sDay === dayOfMonth) activeTimes.push({ time });
                } else if (prefix === 'C') {
                    // Custom: C:YYYY-MM-DD:HH:MM
                    const sDate = parts[1];
                    const time = `${parts[2]}:${parts[3]}`;
                    if (sDate === dateStr) activeTimes.push({ time });
                }
            } else {
                // Daily: HH:MM - Implicitly active every day
                activeTimes.push({ time: encodedString });
            }
        });

        // Create task objects for each time
        activeTimes.forEach(({ time }) => {
            const [h, m] = time.split(':');

            // Construct the local time in the target timezone
            const targetZoned = new Date(zonedDate.getTime());
            targetZoned.setHours(parseInt(h), parseInt(m), 0, 0);

            // Convert to true UTC for the database
            const dueAtUTC = fromZonedTime(targetZoned, householdTimezone);

            tasks.push({
                pet_id: schedule.pet_id || '',
                schedule_id: schedule.id,
                household_id: householdId,
                label: schedule.label || (schedule.task_type === 'feeding' ? 'Feeding' : schedule.task_type === 'care' ? 'Care' : 'Medication'),
                task_type: schedule.task_type || 'care',
                status: 'pending',
                due_at: dueAtUTC.toISOString(),
                created_at: new Date().toISOString()
            });
        });
    });

    return tasks;
}
