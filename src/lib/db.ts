import Dexie, { type Table } from 'dexie';

export interface Profile {
    id: string; // UUID from auth.users
    username: string;
    first_name: string;
    last_name?: string;
    phone?: string;
}

export class AppDatabase extends Dexie {
    profiles!: Table<Profile>;

    constructor() {
        super('OfflineShellDB');
        this.version(2).stores({
            profiles: 'id, username'
        });
    }
}

export const db = new AppDatabase();
