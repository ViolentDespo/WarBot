
import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChatInputCommandInteraction,
    ChannelType,
    ActionRowBuilder,
    RoleSelectMenuBuilder,
    ComponentType,
    EmbedBuilder
} from 'discord.js';
import { db } from '../database/db';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Configure bot settings for this server.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        // We removed the role options, now using Select Menus
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

        const channel = interaction.options.getChannel('channel');

        // Update channel immediately if provided
        if (channel) {
            const stmt = db.prepare(`
                INSERT INTO settings (guild_id, default_channel_id)
                VALUES (?, ?)
                ON CONFLICT(guild_id) DO UPDATE SET
                default_channel_id = excluded.default_channel_id
            `);
            stmt.run(interaction.guildId, channel.id);
        }

        // Create Select Menus
        const leaderSelect = new RoleSelectMenuBuilder()
            .setCustomId('setup_leader_roles')
            .setPlaceholder('Select Leader Roles')
            .setMinValues(0)
            .setMaxValues(25);

        const participantSelect = new RoleSelectMenuBuilder()
            .setCustomId('setup_participant_roles')
            .setPlaceholder('Select Participant Roles')
            .setMinValues(0)
            .setMaxValues(25);

        const row1 = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(leaderSelect);
        const row2 = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(participantSelect);

        const embed = new EmbedBuilder()
            .setTitle('GuildWarBot Setup')
            .setDescription('Please select the roles allowed to manage and participate in wars.\nSelections are saved automatically.')
            .addFields({ name: 'Default Channel', value: channel ? `<#${channel.id}>` : 'Unchanged (or None)' })
            .setColor(0x0099FF);

        await interaction.reply({
            embeds: [embed],
            components: [row1, row2],
            ephemeral: true
        });
    },
};
