
export interface GuildSettings {
    guild_id: string;
    leader_role_ids: string | null; // JSON string
    participant_role_ids: string | null; // JSON string
    default_channel_id: string | null;
}

export interface ReadyCheck {
    id: number;
    message_id: string;
    channel_id: string;
    guild_id: string;
    creator_id: string;
    war_name: string;
    start_time: number;
    status: 'active' | 'ended' | 'removed';
    participating_guilds: string; // JSON string
}

export interface Signup {
    user_id: string;
    readycheck_id: number;
    guild_name: string;
    class_name: string;
}

export const CLASSES = ['Warrior', 'Trojan', 'WaterTao', 'FireTao', 'Archer'] as const;
export type CharacterClass = typeof CLASSES[number];

export const CLASS_EMOJIS: Record<CharacterClass, string> = {
    Warrior: '🛡️',
    Trojan: '⚔️',
    WaterTao: '💧',
    FireTao: '🔥',
    Archer: '🏹'
};
