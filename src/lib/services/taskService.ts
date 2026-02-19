import { supabase } from '$lib/supabase';
import { generateTasksForDate } from '$lib/taskUtils';

// Helper to ensure tasks exist for today
export const ensureDailyTasks = async (householdId: string): Promise<boolean> => {
    try {
        const date = new Date();
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

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
                .gte('due_at', startOfDay.toISOString())
                .lte('due_at', endOfDay.toISOString())
        ]);

        const activeSchedules = schedulesRes.data || [];
        if (activeSchedules.length === 0) return false;

        const existingTasks = tasksRes.data || [];
        const existingMap = new Set(existingTasks.map(t => {
            const time = new Date(t.due_at).getTime();
            return `${t.schedule_id} -${time} `;
        }));

        // 3. Generate candidate tasks
        // Cast to any to avoid TS issues with the joined 'pets' property
        const candidateTasks = generateTasksForDate(activeSchedules as any, date, householdId);

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

// Helper to cleanup stale non-medication tasks (Feedings, Cleaning, etc.)
export const cleanupOldTasks = async (householdId: string) => {
    try {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        // Delete tasks that are:
        // 1. In this household
        // 2. Pending (not completed)
        // 3. Due before today
        // 4. NOT type 'medication'
        const { error } = await supabase
            .from('daily_tasks')
            .delete()
            .eq('household_id', householdId)
            .eq('status', 'pending')
            .lt('due_at', startOfDay.toISOString())
            .neq('task_type', 'medication');

        if (error) {
            console.error("Error cleaning up old tasks:", error);
        } else {
            console.log("Cleaned up stale non-medication tasks.");
        }
    } catch (e) {
        console.error("cleanupOldTasks failed:", e);
    }
};
