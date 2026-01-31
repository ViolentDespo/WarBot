
import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionsBitField } from 'discord.js';
import { db } from '../database/db';
import { ReadyCheck, GuildSettings } from '../types';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('remove')
        .setDescription('Remove a readycheck.')
        .addStringOption(option =>
            option.setName('readycheck_id')
                .setDescription('ID of the readycheck (optional, defaults to active in channel)')
                .setRequired(false)),

    async execute(interaction: ChatInputCommandInteraction) {
        if (!interaction.guildId) return;

        // Check Permissions (Admin OR Leader)
        const settings = db.prepare('SELECT * FROM settings WHERE guild_id = ?').get(interaction.guildId) as GuildSettings | undefined;

        const member = await interaction.guild?.members.fetch(interaction.user.id);
        if (!member) return;

        const isAdmin = member.permissions.has(PermissionsBitField.Flags.Administrator);
        const isLeader = settings?.leader_role_id ? member.roles.cache.has(settings.leader_role_id) : false;

        if (!isAdmin && !isLeader) {
            await interaction.reply({ content: 'You do not have permission to remove readychecks.', ephemeral: true });
            return;
        }

        const readyCheckId = interaction.options.getString('readycheck_id');
        let readyCheck: ReadyCheck | undefined;

        if (readyCheckId) {
            readyCheck = db.prepare('SELECT * FROM readychecks WHERE id = ? AND guild_id = ? AND status = ?').get(readyCheckId, interaction.guildId, 'active') as ReadyCheck;
        } else {
            // Find latest active in channel
            readyCheck = db.prepare('SELECT * FROM readychecks WHERE channel_id = ? AND status = ? ORDER BY id DESC LIMIT 1').get(interaction.channelId, 'active') as ReadyCheck;
        }

        if (!readyCheck) {
            await interaction.reply({ content: 'No active readycheck found to remove.', ephemeral: true });
            return;
        }

        // Additional check: If not Admin, must be creator
        if (!isAdmin && readyCheck.creator_id !== interaction.user.id) {
            await interaction.reply({ content: 'You can only remove readychecks you created (unless you are an Admin).', ephemeral: true });
            return;
        }

        // Logic to remove
        db.prepare('UPDATE readychecks SET status = ? WHERE id = ?').run('removed', readyCheck.id);

        // Try to delete or edit the original message
        try {
            const channel = await interaction.client.channels.fetch(readyCheck.channel_id);
            if (channel && channel.isTextBased()) {
                const message = await channel.messages.fetch(readyCheck.message_id);
                if (message) {
                    await message.edit({ content: `**READYCHECK REMOVED** by ${interaction.user}`, embeds: [], components: [] });
                }
            }
        } catch (e) {
            console.error('Failed to update removed message', e);
        }

        await interaction.reply({ content: `Readycheck '${readyCheck.war_name}' removed.`, ephemeral: true });
    },
};
