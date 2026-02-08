
import { supabase } from '$lib/supabase';
import type { Database } from '$lib/database.types';

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

            if (!data || data.length === 0) {
                throw new Error('No history found to export for the selected criteria.');
            }

            // 2. Generate PDF
            const { Capacitor } = await import('@capacitor/core');
            const { jsPDF } = await import('jspdf');
            const autoTable = (await import('jspdf-autotable')).default;

            const doc = new jsPDF();

            // Title & Header
            doc.setFontSize(22);
            doc.setTextColor(47, 79, 79); // Dark Sage

            let title = 'WhoFed Export';
            if (options.scope === 'household') title = 'Household History';
            if (options.scope === 'pet') title = options.medicalOnly ? 'Medical History' : 'Pet History';

            doc.text(title, 14, 20);

            doc.setFontSize(10);
            doc.setTextColor(100, 100, 100);
            doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 28);
            if (options.medicalOnly) {
                doc.setTextColor(220, 53, 69); // Red for emphasis
                doc.text('Medical Records Only', 14, 34);
            }

            // Table Data
            const tableHeaders = [['Date', 'Pet', 'Action', 'Details', 'Performed By']];

            const formatAction = (action: string) => {
                if (action === 'unfed') return 'un-fed';
                if (action === 'unmedicated') return 'X MISSED MED';
                if (action === 'medication') return 'Medication';
                return action.charAt(0).toUpperCase() + action.slice(1);
            }

            const tableRows = data.map((row: any) => {
                const date = new Date(row.performed_at);
                const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

                let details = row.schedules?.label || row.daily_tasks?.label || '-';

                return [
                    dateStr,
                    row.pets?.name || 'Unknown Pet',
                    formatAction(row.action_type),
                    details,
                    row.profiles?.first_name || 'Unknown User'
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
