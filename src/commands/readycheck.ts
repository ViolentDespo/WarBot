
import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionsBitField, ChannelType, TextChannel } from 'discord.js';
import { db } from '../database/db';
import { GuildSettings } from '../types';
import { generateReadyCheckEmbed } from '../utils';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('readycheck')
        .setDescription('Start a new war readycheck.')
        .addStringOption(option =>
            option.setName('war_name')
                .setDescription('Name of the war')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('guilds')
                .setDescription('Comma separated list of participating guilds (min 2)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('start_time')
                .setDescription('Start time (Unix Timestamp OR "YYYY-MM-DD HH:MM")')
                .setRequired(true))
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('Channel to post in (defaults to configured or current)')
                .addChannelTypes(ChannelType.GuildText)),

    async execute(interaction: ChatInputCommandInteraction) {
        if (!interaction.guildId) return;

        // 1. Permission Check
        const settings = db.prepare('SELECT * FROM settings WHERE guild_id = ?').get(interaction.guildId) as GuildSettings | undefined;

        const member = await interaction.guild?.members.fetch(interaction.user.id);
        const isAdmin = member?.permissions.has(PermissionsBitField.Flags.Administrator);
        const isLeader = settings?.leader_role_id && member?.roles.cache.has(settings.leader_role_id);

        if (!isAdmin && !isLeader) {
            await interaction.reply({ content: 'You do not have permission to start readychecks.', ephemeral: true });
            return;
        }

        // 2. Parse Arguments
        const warName = interaction.options.getString('war_name', true);
        const guildsStr = interaction.options.getString('guilds', true);
        const startTimeStr = interaction.options.getString('start_time', true);
        const targetChannelOpt = interaction.options.getChannel('channel');

        // Parse Guilds
        const guilds = guildsStr.split(',').map(s => s.trim()).filter(s => s.length > 0);
        if (guilds.length < 2) {
            await interaction.reply({ content: 'You must specify at least 2 guilds, separated by commas.', ephemeral: true });
            return;
        }

        // Parse Time
        let startTime: number;
        // Check if numeric (timestamp)
        if (/^\d+$/.test(startTimeStr)) {
            startTime = parseInt(startTimeStr);
        } else {
            // Try to parse date string
            const date = new Date(startTimeStr);
            if (isNaN(date.getTime())) {
                await interaction.reply({ content: 'Invalid start time format. Please use a Unix Timestamp or a valid date string.', ephemeral: true });
                return;
            }
            startTime = Math.floor(date.getTime() / 1000);
        }

        // Determine Channel
        let channelId = settings?.default_channel_id || interaction.channelId;
        if (targetChannelOpt) {
            channelId = targetChannelOpt.id;
        }

        // 3. Create DB Entry (Temporary placeholder to get ID if needed, or insert after sending? Better to insert after sending to get message ID)

        // 4. Send Message
        try {
            const channel = await interaction.guild?.channels.fetch(channelId);
            if (!channel || !channel.isTextBased()) {
                await interaction.reply({ content: 'Invalid target channel.', ephemeral: true });
                return;
            }

            // Construct initial data object for helper (without ID)
            const partialReadyCheck: any = {
                id: 0, // Placeholder
                war_name: warName,
                start_time: startTime,
                creator_id: interaction.user.id,
                participating_guilds: JSON.stringify(guilds)
            };

            // We can't generate the embed properly without the ID if we put ID in footer, but let's insert first?
            // Actually, let's insert pending with dummy message ID, then update.
            const insert = db.prepare(`
                INSERT INTO readychecks (message_id, channel_id, guild_id, creator_id, war_name, start_time, participating_guilds)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `);
            const result = insert.run('PENDING', channelId, interaction.guildId, interaction.user.id, warName, startTime, JSON.stringify(guilds));
            const newId = result.lastInsertRowid;

            partialReadyCheck.id = newId;
            const embed = generateReadyCheckEmbed(partialReadyCheck);

            const message = await (channel as TextChannel).send({ embeds: [embed] });

            // Update DB with real message ID
            db.prepare('UPDATE readychecks SET message_id = ? WHERE id = ?').run(message.id, newId);

            await interaction.reply({ content: `Readycheck created in <#${channelId}>!`, ephemeral: true });

        } catch (error) {
            console.error(error);
            await interaction.reply({ content: 'Failed to create readycheck. Check logs.', ephemeral: true });
        }
    },
};
