import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface Phrase {
	id: string;
	text: string;
	category: string;
}

export interface LeaderboardEntry {
	id: string;
	name: string;
	email: string | null;
	time_ms: number;
	difficulty: string;
	created_at: string;
}

export interface GamePlay {
	id: string;
	difficulty: string;
	score: number;
	time_ms: number;
	completed: boolean;
	created_at: string;
}

export interface CustomGame {
	token: string;
	fonts: string[];
	font_count: number;
	creator_name: string | null;
	created_at: string;
}

export interface CustomGameScore {
	id: string;
	token: string;
	name: string;
	email: string | null;
	score: number;
	time_ms: number;
	created_at: string;
}
