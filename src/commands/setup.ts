
import { SlashCommandBuilder, PermissionFlagsBits, ChatInputCommandInteraction, Role, ChannelType } from 'discord.js';
import { db } from '../database/db';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Configure bot settings for this server.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addRoleOption(option =>
            option.setName('leader_role')
                .setDescription('Role allowed to create readychecks')
                .setRequired(true))
        .addRoleOption(option =>
            option.setName('participant_role')
                .setDescription('Role allowed to sign up')
                .setRequired(true))
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('Default channel for readychecks')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(false)),

    async execute(interaction: ChatInputCommandInteraction) {
        if (!interaction.guildId) {
            await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
            return;
        }

        const leaderRole = interaction.options.getRole('leader_role') as Role;
        const participantRole = interaction.options.getRole('participant_role') as Role;
        const channel = interaction.options.getChannel('channel');

        const stmt = db.prepare(`
            INSERT INTO settings (guild_id, leader_role_id, participant_role_id, default_channel_id)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(guild_id) DO UPDATE SET
            leader_role_id = excluded.leader_role_id,
            participant_role_id = excluded.participant_role_id,
            default_channel_id = excluded.default_channel_id
        `);

        stmt.run(
            interaction.guildId,
            leaderRole.id,
            participantRole.id,
            channel ? channel.id : null
        );

        await interaction.reply({
            content: `Setup complete!\nLeader Role: ${leaderRole}\nParticipant Role: ${participantRole}\nDefault Channel: ${channel ? channel : 'None (Current channel will be used)'}`,
            ephemeral: true
        });
    },
};
