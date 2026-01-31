
import { EmbedBuilder } from 'discord.js';
import { db } from './database/db';
import { ReadyCheck, Signup } from './types';

export const generateReadyCheckEmbed = (readyCheck: ReadyCheck) => {
    const signups = db.prepare('SELECT * FROM signups WHERE readycheck_id = ?').all(readyCheck.id) as Signup[];
    const participatingGuilds: string[] = JSON.parse(readyCheck.participating_guilds);

    const embed = new EmbedBuilder()
        .setTitle(`⚔️ WAR READYCHECK: ${readyCheck.war_name}`)
        .setDescription(`**Start Time**: <t:${readyCheck.start_time}:F> (<t:${readyCheck.start_time}:R>)\n**Created By**: <@${readyCheck.creator_id}>`)
        .setColor(0xFF0000)
        .setTimestamp();

    // Group signups by guild
    const guildData = new Map<string, Signup[]>();
    participatingGuilds.forEach(g => guildData.set(g, []));

    signups.forEach(s => {
        if (guildData.has(s.guild_name)) {
            guildData.get(s.guild_name)?.push(s);
        } else {
            // Handle edge case where guild might have been removed or something, or just add it
            if (!guildData.has(s.guild_name)) guildData.set(s.guild_name, []);
            guildData.get(s.guild_name)?.push(s);
        }
    });

    participatingGuilds.forEach(guildName => {
        const guildSignups = guildData.get(guildName) || [];
        const total = guildSignups.length;

        // Count classes
        const classCounts = new Map<string, number>();
        guildSignups.forEach(s => {
            classCounts.set(s.class_name, (classCounts.get(s.class_name) || 0) + 1);
        });

        const classSummaryParts: string[] = [];
        classCounts.forEach((count, className) => {
            classSummaryParts.push(`${className}: ${count}`);
        });
        const classSummary = classSummaryParts.length > 0 ? classSummaryParts.join(', ') : 'No classes yet';

        // Player list (limit length to avoid embed limits)
        // We will just list names. If too many, we might truncate.
        // For now, let's just list 
        const playerList = guildSignups.map(s => `<@${s.user_id}> (${s.class_name})`).join('\n');
        const displayedList = playerList.length > 1000 ? playerList.substring(0, 997) + '...' : playerList;

        embed.addFields({
            name: `${guildName} (Total: ${total})`,
            value: `**Classes**: ${classSummary}\n\n${displayedList || '_No signups yet._'}`,
            inline: false // Stack them vertically for readability
        });
    });

    embed.setFooter({ text: `ID: ${readyCheck.id} | /signup to join` });

    return embed;
};
