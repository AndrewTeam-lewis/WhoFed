
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Manually parse .env
const envPath = path.resolve(process.cwd(), '.env');
const envConfig = fs.readFileSync(envPath, 'utf8').split('\n').reduce((acc, line) => {
    const [key, ...values] = line.split('=');
    if (key && values.length > 0) {
        acc[key.trim()] = values.join('=').trim();
    }
    return acc;
}, {} as Record<string, string>);

const supabaseUrl = envConfig.VITE_SUPABASE_URL;
const supabaseServiceKey = envConfig.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing environment variables. Content:', envConfig);
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkSchedules() {
    // 1. Get all pets
    const { data: pets, error: petsError } = await supabase.from('pets').select('id, name');
    if (petsError) {
        console.error('Error fetching pets:', petsError);
        return;
    }

    console.log('Pets:', pets);

    for (const pet of pets) {
        const { data: schedules, error: schedError } = await supabase
            .from('schedules')
            .select('*')
            .eq('pet_id', pet.id);

        if (schedError) {
            console.error(`Error fetching schedules for ${pet.name}:`, schedError);
        } else {
            console.log(`Schedules for ${pet.name} (${pet.id}):`, schedules?.length);
            if (schedules && schedules.length > 0) {
                console.log(JSON.stringify(schedules, null, 2));
            }
        }
    }
}

checkSchedules();
