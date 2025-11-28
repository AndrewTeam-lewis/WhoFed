import Dexie, { type Table } from 'dexie';

export interface User {
    id?: number;
    username: string;
    email: string;
    passwordHash: string;
    firstName: string;
    phone: string;
    synced: number; // 0 = not synced, 1 = synced
}

export class AppDatabase extends Dexie {
    users!: Table<User>;

    constructor() {
        super('OfflineShellDB');
        this.version(1).stores({
            users: '++id, username, &email, firstName, phone, synced'
        });
    }
}

export const db = new AppDatabase();
