import Dexie, { type Table } from 'dexie';

export interface Profile {
    id: string; // UUID from auth.users
    username: string | null;
    first_name: string | null;
    tier?: string; // 'free' | 'premium'
    tier?: string; // 'free' | 'premium'
}

export class AppDatabase extends Dexie {
    profiles!: Table<Profile>;

    constructor() {
        super('OfflineShellDB');
        this.version(3).stores({
            profiles: 'id, username'
        });
    }
}

export const db = new AppDatabase();
