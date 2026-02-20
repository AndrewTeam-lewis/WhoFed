
import { supabase } from '$lib/supabase';
import type { Database } from '$lib/database.types';
import { get } from 'svelte/store';
import { t, formatDateTime } from '$lib/services/i18n';

export type ExportScope = 'all' | 'household' | 'pet';

export interface ExportOptions {
    scope: ExportScope;
    id?: string; // household_id or pet_id
    medicalOnly?: boolean;
    dateRange?: { start: Date; end: Date }; // Optional future-proofing
}

export const exportService = {
    async exportData(options: ExportOptions) {
        try {
            // 1. Fetch Data based on scope
            let query: any = supabase
                .from('activity_log')
                .select(`
                    task_id,
                    performed_at,
                    action_type,
                    pets (name, household_id),
                    profiles (first_name, email),
                    schedules (label),
                    daily_tasks (label)
                `) // Added medications join in case we use it, though usually schedule label covers it
                .order('performed_at', { ascending: false });

            if (options.scope === 'household' && options.id) {
                // We need to filter by pets in this household.
                // Activity log is linked to pets.
                // We could do a join filter: !inner join on pets
                query = supabase
                    .from('activity_log')
                    .select(`
                        task_id,
                        performed_at,
                        action_type,
                        pets!inner (name, household_id),
                        profiles (first_name, email),
                        schedules (label),
                        daily_tasks (label)
                    `)
                    .eq('pets.household_id', options.id)
                    .order('performed_at', { ascending: false });
            } else if (options.scope === 'pet' && options.id) {
                query = query.eq('pet_id', options.id);
            }

            if (options.medicalOnly) {
                // Filter for medical related actions
                // This might vary based on how 'medical' is defined in the app.
                // Typically action_type = 'medication' or task_type 'medication'
                // But activity_log just has action_type like 'fed', 'medication', etc?
                // Let's assume action_type='medication' or check schedule/task type if available.
                // For now, simple filter on action_type
                query = query.in('action_type', ['medication', 'unmedicated']);
            }

            const { data, error } = await query;
            if (error) throw error;

            // Filter out undone actions
            const undoneTaskIds = new Set<string>();
            const filteredData = [];

            for (const row of (data || [])) {
                if (row.action_type.startsWith('un')) {
                    if (row.task_id) {
                        undoneTaskIds.add(row.task_id);
                    }
                    continue; // Skip the un- action
                }
                if (row.task_id && undoneTaskIds.has(row.task_id)) {
                    // This is the original action that was cancelled
                    undoneTaskIds.delete(row.task_id);
                    continue; // Skip original action
                }
                filteredData.push(row);
            }

            if (filteredData.length === 0) {
                const currentT = get(t);
                throw new Error(currentT.export?.error_no_history || 'No history found to export for the selected criteria.');
            }

            // 2. Generate PDF
            const { Capacitor } = await import('@capacitor/core');
            const { jsPDF } = await import('jspdf');
            const autoTable = (await import('jspdf-autotable')).default;

            const doc = new jsPDF();
            const currentT = get(t).export;

            // Title & Header
            doc.setFontSize(22);
            doc.setTextColor(47, 79, 79); // Dark Sage

            let title = currentT?.pdf_title || 'WhoFed Export';
            if (options.scope === 'household') title = currentT?.pdf_title_household || 'Household History';
            if (options.scope === 'pet') title = options.medicalOnly ? (currentT?.pdf_title_medical || 'Medical History') : (currentT?.pdf_title_pet || 'Pet History');

            doc.text(title, 14, 20);

            doc.setFontSize(10);
            doc.setTextColor(100, 100, 100);
            const formatDT = get(formatDateTime);
            doc.text(`${currentT?.generated_on || 'Generated on'}: ${formatDT(new Date())}`, 14, 28);
            if (options.medicalOnly) {
                doc.setTextColor(220, 53, 69); // Red for emphasis
                doc.text(currentT?.medical_only || 'Medical Records Only', 14, 34);
            }

            // Table Data
            const tableHeaders = [[
                currentT?.col_date || 'Date',
                currentT?.col_pet || 'Pet',
                currentT?.col_action || 'Action',
                currentT?.col_details || 'Details',
                currentT?.col_performed_by || 'Performed By'
            ]];

            const formatAction = (action: string) => {
                if (action === 'unfed') return currentT?.action_unfed || 'un-fed';
                if (action === 'unmedicated') return currentT?.action_unmedicated || 'X MISSED MED';
                if (action === 'medication') return currentT?.action_medication || 'Medication';
                return action.charAt(0).toUpperCase() + action.slice(1);
            }

            const tableRows = filteredData.map((row: any) => {
                const date = new Date(row.performed_at);
                const dateStr = formatDT(date);

                let details = row.schedules?.label || row.daily_tasks?.label || '-';

                return [
                    dateStr,
                    row.pets?.name || currentT?.unknown_pet || 'Unknown Pet',
                    formatAction(row.action_type),
                    details,
                    row.profiles?.first_name || currentT?.unknown_user || 'Unknown User'
                ];
            });

            const startY = options.medicalOnly ? 40 : 35;

            autoTable(doc, {
                head: tableHeaders,
                body: tableRows,
                startY: startY,
                theme: 'grid',
                headStyles: {
                    fillColor: [75, 114, 109], // Brand Sage Green
                    textColor: 255,
                    fontStyle: 'bold'
                },
                styles: {
                    fontSize: 10,
                    cellPadding: 3
                },
                alternateRowStyles: {
                    fillColor: [245, 247, 247] // Very light sage/gray
                }
            });

            // 3. Save / Open
            const fileName = `WhoFed_${title.replace(' ', '_')}_${new Date().toISOString().split('T')[0]}.pdf`;

            if (Capacitor.isNativePlatform()) {
                const { Filesystem, Directory } = await import('@capacitor/filesystem');
                const { FileOpener } = await import('@capacitor-community/file-opener');

                const base64 = doc.output('datauristring').split(',')[1];

                const result = await Filesystem.writeFile({
                    path: fileName,
                    data: base64,
                    directory: Directory.Cache
                });

                await FileOpener.open({
                    filePath: result.uri,
                    contentType: 'application/pdf'
                });

            } else {
                doc.save(fileName);
            }

            return true;

        } catch (err: any) {
            console.error('Export Service Error:', err);
            throw err;
        }
    }
};
