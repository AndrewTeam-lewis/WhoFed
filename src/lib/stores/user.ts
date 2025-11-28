import { writable } from 'svelte/store';
import type { User } from '$lib/db';

export const currentUser = writable<User | null>(null);
