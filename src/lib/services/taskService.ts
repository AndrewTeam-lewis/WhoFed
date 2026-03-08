import { supabase } from '$lib/supabase';
import { generateTasksForDate } from '$lib/taskUtils';
import { get } from 'svelte/store';
import { availableHouseholds } from '$lib/stores/appState';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

// Get household timezone from state cache quietly
function getHouseholdTimezone(householdId: string): string {
    const hh = get(availableHouseholds).find(h => h.id === householdId);
    return hh?.timezone || 'America/New_York';
}

// Helper to ensure tasks exist for today
export const ensureDailyTasks = async (householdId: string): Promise<boolean> => {
    try {
        const tz = getHouseholdTimezone(householdId);
        const date = new Date(); // local current instant

        // Find what "today" means right now in that timezone
        const zoned = toZonedTime(date, tz);

        // Start of Day in TZ
        const startZoned = new Date(zoned.getTime());
        startZoned.setHours(0, 0, 0, 0);
        const startOfDayUTC = fromZonedTime(startZoned, tz);

        // End of Day in TZ
        const endZoned = new Date(zoned.getTime());
        endZoned.setHours(23, 59, 59, 999);
        const endOfDayUTC = fromZonedTime(endZoned, tz);

        // Optimization: Run queries in parallel
        // 1. Get enabled schedules (joined with pets to filter by household)
        // 2. Get existing tasks for today
        const [schedulesRes, tasksRes] = await Promise.all([
            supabase
                .from('schedules')
                .select('*, pets!inner(household_id)')
                .eq('pets.household_id', householdId)
                .eq('is_enabled', true),

            supabase
                .from('daily_tasks')
                .select('schedule_id, due_at')
                .eq('household_id', householdId)
                .gte('due_at', startOfDayUTC.toISOString())
                .lte('due_at', endOfDayUTC.toISOString())
        ]);

        const activeSchedules = schedulesRes.data || [];
        if (activeSchedules.length === 0) return false;

        const existingTasks = tasksRes.data || [];
        const existingMap = new Set(existingTasks.map(t => {
            const time = new Date(t.due_at).getTime();
            return `${t.schedule_id} -${time} `;
        }));

        // 3. Generate candidate tasks
        const candidateTasks = generateTasksForDate(activeSchedules as any, date, householdId, tz);

        // 4. Filter out ones that already exist
        const toInsert = candidateTasks.filter(t => {
            const time = new Date(t.due_at).getTime();
            return !existingMap.has(`${t.schedule_id} -${time} `);
        });

        if (toInsert.length > 0) {
            console.log(`Generating ${toInsert.length} missing tasks...`);
            const { error: insertError } = await supabase
                .from('daily_tasks')
                .insert(toInsert);

            if (insertError) {
                console.error("Error generating tasks:", insertError);
                return false;
            } else {
                console.log(`Successfully generated ${toInsert.length} new tasks.`);
                return true;
            }
        }

        return false;
    } catch (e) {
        console.error("ensureDailyTasks failed:", e);
        return false;
    }
};

// Track last cleanup time per household (in-memory)
const lastCleanup: Record<string, number> = {};

// Helper to cleanup stale non-medication tasks (Feedings, Cleaning, etc.)
export const cleanupOldTasks = async (householdId: string) => {
    try {
        // Only run cleanup once per day per household
        const now = Date.now();
        const lastRun = lastCleanup[householdId] || 0;
        const oneDay = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

        if (now - lastRun < oneDay) {
            console.log(`Cleanup already ran today for household ${householdId}`);
            return;
        }

        // Get start of today in the household timezone
        const tz = getHouseholdTimezone(householdId);
        const nowZoned = toZonedTime(new Date(), tz);
        const startZoned = new Date(nowZoned.getTime());
        startZoned.setHours(0, 0, 0, 0);

        const startOfDayUTC = fromZonedTime(startZoned, tz);

        // Delete tasks that are:
        // 1. In this household
        // 2. Pending (not completed)
        // 3. Due before today (in local timezone equivalent)
        // 4. NOT type 'medication' (medications persist until completed)
        const { error, count } = await supabase
            .from('daily_tasks')
            .delete({ count: 'exact' })
            .eq('household_id', householdId)
            .eq('status', 'pending')
            .lt('due_at', startOfDayUTC.toISOString())
            .neq('task_type', 'medication');

        if (error) {
            console.error("Error cleaning up old tasks:", error);
        } else {
            console.log(`Cleaned up ${count || 0} stale non-medication tasks.`);
            // Mark cleanup as done for this household
            lastCleanup[householdId] = Date.now();
        }
    } catch (e) {
        console.error("cleanupOldTasks failed:", e);
    }
};
