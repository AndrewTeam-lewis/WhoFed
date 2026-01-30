import { supabase } from '$lib/supabase';
import { generateTasksForDate } from '$lib/taskUtils';

// Helper to ensure tasks exist for today
export const ensureDailyTasks = async (householdId: string) => {
    try {
        const date = new Date();
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        // 1. Get all pets in the household
        const { data: pets } = await supabase.from('pets').select('id').eq('household_id', householdId);
        if (!pets || pets.length === 0) return;
        const petIds = pets.map(p => p.id);

        // 2. Get all ENABLED schedules
        const { data: activeSchedules } = await supabase
            .from('schedules')
            .select('*')
            .eq('is_enabled', true)
            .in('pet_id', petIds);

        if (!activeSchedules || activeSchedules.length === 0) return;

        // 3. Get existing tasks for today to avoid duplicates
        const { data: existingTasks } = await supabase
            .from('daily_tasks')
            .select('schedule_id, due_at')
            .eq('household_id', householdId)
            .gte('due_at', startOfDay.toISOString())
            .lte('due_at', endOfDay.toISOString());

        const existingMap = new Set(existingTasks?.map(t => {
            const time = new Date(t.due_at).getTime();
            return `${t.schedule_id}-${time}`;
        }));

        // 4. Generate candidate tasks
        const candidateTasks = generateTasksForDate(activeSchedules, date, householdId);

        // 5. Filter out ones that already exist (using timestamp comparison)
        const toInsert = candidateTasks.filter(t => {
            const time = new Date(t.due_at).getTime();
            return !existingMap.has(`${t.schedule_id}-${time}`);
        });

        if (toInsert.length > 0) {
            console.log(`Generating ${toInsert.length} missing tasks...`);
            const { error: insertError } = await supabase
                .from('daily_tasks')
                .insert(toInsert);

            if (insertError) {
                console.error("Error generating tasks:", insertError);
            } else {
                console.log(`Successfully generated ${toInsert.length} new tasks.`);
            }
        } else {
            // console.log("All schedules have tasks generated for today.");
        }

    } catch (e) {
        console.error("ensureDailyTasks failed:", e);
    }
};
