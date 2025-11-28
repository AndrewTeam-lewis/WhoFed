import { db, type User } from '$lib/db';
import bcrypt from 'bcryptjs';

export interface RegisterData {
    username: string;
    email: string;
    password: string;
    firstName: string;
    phone: string;
}

export const authService = {
    async register(data: RegisterData) {
        const existingUser = await db.users
            .where('username').equals(data.username)
            .or('email').equals(data.email)
            .first();

        if (existingUser) {
            throw new Error('Username or Email already exists');
        }

        const passwordHash = await bcrypt.hash(data.password, 10);

        const userId = await db.users.add({
            username: data.username,
            email: data.email,
            passwordHash,
            firstName: data.firstName,
            phone: data.phone,
            synced: 0
        });

        return userId;
    },

    async login(usernameOrEmail: string, password: string) {
        const user = await db.users
            .where('username').equals(usernameOrEmail)
            .or('email').equals(usernameOrEmail)
            .first();

        if (!user) {
            throw new Error('Invalid credentials');
        }

        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) {
            throw new Error('Invalid credentials');
        }

        return user;
    },

    async updatePassword(userId: number, newPassword: string) {
        const passwordHash = await bcrypt.hash(newPassword, 10);
        await db.users.update(userId, { passwordHash, synced: 0 });
    }
};
