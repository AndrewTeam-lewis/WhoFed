import type { Database } from './database.types';

type Schedule = Database['public']['Tables']['schedules']['Row'];
type DailyTaskInsert = Database['public']['Tables']['daily_tasks']['Insert'];

export function generateTasksForDate(
    schedules: Schedule[],
    date: Date,
    householdId: string
): DailyTaskInsert[] {
    const tasks: DailyTaskInsert[] = [];

    // Normalize date to YYYY-MM-DD (Local Time)
    const dateStr = date.toLocaleDateString('en-CA');
    const dayOfWeek = date.getDay(); // 0 = Sun
    const dayOfMonth = date.getDate(); // 1-31

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
            const dueAt = new Date(date);
            dueAt.setHours(parseInt(h), parseInt(m), 0, 0);

            tasks.push({
                pet_id: schedule.pet_id || '',
                schedule_id: schedule.id,
                household_id: householdId,
                label: schedule.label || (schedule.task_type === 'feeding' ? 'Feeding' : schedule.task_type === 'care' ? 'Care' : 'Medication'),
                task_type: schedule.task_type || 'care',
                status: 'pending',
                due_at: dueAt.toISOString(),
                created_at: new Date().toISOString()
            });
        });
    });

    return tasks;
}
