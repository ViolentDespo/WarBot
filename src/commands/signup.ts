
import { SlashCommandBuilder, ChatInputCommandInteraction, TextChannel } from 'discord.js';
import { db } from '../database/db';
import { GuildSettings, ReadyCheck, CLASSES } from '../types';
import { generateReadyCheckEmbed } from '../utils';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('signup')
        .setDescription('Sign up for a war.')
        .addStringOption(option =>
            option.setName('guild')
                .setDescription('The guild you are playing with')
                .setRequired(true)) // We will use autocomplete or just text validation
        .addStringOption(option =>
            option.setName('class')
                .setDescription('Your class')
                .setRequired(true)
                .addChoices(...CLASSES.map(c => ({ name: c, value: c }))))
        .addStringOption(option =>
            option.setName('readycheck_id')
                .setDescription('Specific ReadyCheck ID (optional)')
                .setRequired(false)),

    async execute(interaction: ChatInputCommandInteraction) {
        if (!interaction.guildId) return;

        // 1. Permission Check
        const settings = db.prepare('SELECT * FROM settings WHERE guild_id = ?').get(interaction.guildId) as GuildSettings | undefined;
        const member = await interaction.guild?.members.fetch(interaction.user.id);

        // If participant role is set, check it. (Admin always allowed? Maybe not for signup, stick to role)
        if (settings?.participant_role_id) {
            if (!member?.roles.cache.has(settings.participant_role_id)) {
                await interaction.reply({ content: 'You do not have the participant role required to sign up.', ephemeral: true });
                return;
            }
        }

        // 2. Find Readycheck
        const readyCheckId = interaction.options.getString('readycheck_id');
        let readyCheck: ReadyCheck | undefined;

        if (readyCheckId) {
            readyCheck = db.prepare('SELECT * FROM readychecks WHERE id = ? AND guild_id = ? AND status = ?').get(readyCheckId, interaction.guildId, 'active') as ReadyCheck;
        } else {
            // Find latest active in channel
            readyCheck = db.prepare('SELECT * FROM readychecks WHERE channel_id = ? AND status = ? ORDER BY id DESC LIMIT 1').get(interaction.channelId, 'active') as ReadyCheck;
        }

        if (!readyCheck) {
            await interaction.reply({ content: 'No active readycheck found in this channel. Please specify an ID if it is elsewhere.', ephemeral: true });
            return;
        }

        // 3. Validate Guild Choice
        const targetGuild = interaction.options.getString('guild', true);
        const allowedGuilds: string[] = JSON.parse(readyCheck.participating_guilds);
        // Case insensitive match?
        const matchedGuild = allowedGuilds.find(g => g.toLowerCase() === targetGuild.toLowerCase());
        if (!matchedGuild) {
            await interaction.reply({
                content: `Invalid guild. Choose one of: ${allowedGuilds.join(', ')}`,
                ephemeral: true
            });
            return;
        }

        // 4. Validate Class
        const targetClass = interaction.options.getString('class', true);

        // 5. Update/Insert Signup
        const stmt = db.prepare(`
            INSERT INTO signups (user_id, readycheck_id, guild_name, class_name)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(user_id, readycheck_id) DO UPDATE SET
            guild_name = excluded.guild_name,
            class_name = excluded.class_name
        `);

        stmt.run(interaction.user.id, readyCheck.id, matchedGuild, targetClass);

        // 6. Update Embed
        try {
            const channel = await interaction.client.channels.fetch(readyCheck.channel_id);
            if (channel && channel.isTextBased()) {
                const message = await (channel as TextChannel).messages.fetch(readyCheck.message_id);
                if (message) {
                    const newEmbed = generateReadyCheckEmbed(readyCheck);
                    await message.edit({ embeds: [newEmbed] });
                }
            }
            await interaction.reply({ content: `Signed up as **${targetClass}** for **${matchedGuild}**!`, ephemeral: true });
        } catch (error) {
            console.error('Failed to update embed', error);
            await interaction.reply({ content: 'Signed up, but failed to update the visual embed.', ephemeral: true });
        }
    },
};
