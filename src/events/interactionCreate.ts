
import { Events, Interaction, ComponentType, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ActionRowBuilder, TextChannel, ButtonInteraction } from 'discord.js';
import { db } from '../database/db';
import { ReadyCheck, CLASSES, CLASS_EMOJIS, CharacterClass, GuildSettings } from '../types'; // Import types
import { generateReadyCheckEmbed } from '../utils';

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction: Interaction) {
        // --- 1. Chat Input Commands (Slash Commands) ---
        if (interaction.isChatInputCommand()) {
            const client = interaction.client as any;
            const command = client.commands.get(interaction.commandName);

            if (!command) {
                console.error(`No command matching ${interaction.commandName} was found.`);
                return;
            }

            try {
                await command.execute(interaction);
            } catch (error) {
                console.error(error);
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
                } else {
                    await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
                }
            }
        }

        // --- 2. Role Select Menus (Setup) ---
        else if (interaction.isRoleSelectMenu()) {
            if (interaction.customId === 'setup_leader_roles' || interaction.customId === 'setup_participant_roles') {
                if (!interaction.guildId) return;

                const column = interaction.customId === 'setup_leader_roles' ? 'leader_role_ids' : 'participant_role_ids';
                const selectedRoleIds = interaction.values;

                try {
                    db.prepare('INSERT OR IGNORE INTO settings (guild_id) VALUES (?)').run(interaction.guildId);

                    const stmt = db.prepare(`UPDATE settings SET ${column} = ? WHERE guild_id = ?`);
                    stmt.run(JSON.stringify(selectedRoleIds), interaction.guildId);

                    await interaction.reply({
                        content: `Updated ${column === 'leader_role_ids' ? 'Leader' : 'Participant'} roles: ${selectedRoleIds.map(id => `<@&${id}>`).join(', ')}`,
                        ephemeral: true
                    });
                } catch (error) {
                    console.error(error);
                    await interaction.reply({ content: 'Failed to save settings.', ephemeral: true });
                }
            }
        }

        // --- 3. Buttons (Signup Start) ---
        else if (interaction.isButton()) {
            if (interaction.customId.startsWith('signup_start_')) {
                const readyCheckId = interaction.customId.replace('signup_start_', '');

                // Get ReadyCheck details to know Guilds
                const readyCheck = db.prepare('SELECT * FROM readychecks WHERE id = ?').get(readyCheckId) as ReadyCheck;
                if (!readyCheck) {
                    await interaction.reply({ content: 'This readycheck no longer exists.', ephemeral: true });
                    return;
                }

                // Parse Guilds
                const participatingGuilds: string[] = JSON.parse(readyCheck.participating_guilds);

                // Create Guild Select
                const guildSelect = new StringSelectMenuBuilder()
                    .setCustomId(`signup_guild_${readyCheckId}`)
                    .setPlaceholder('Select your Guild')
                    .addOptions(
                        participatingGuilds.map(guild =>
                            new StringSelectMenuOptionBuilder()
                                .setLabel(guild)
                                .setValue(guild)
                                .setEmoji('🛡️') // Generic shield or maybe custom logic if user wants
                        )
                    );

                // Create Class Select
                const classSelect = new StringSelectMenuBuilder()
                    .setCustomId(`signup_class_${readyCheckId}`)
                    .setPlaceholder('Select your Class')
                    .addOptions(
                        CLASSES.map(cls =>
                            new StringSelectMenuOptionBuilder()
                                .setLabel(cls)
                                .setValue(cls)
                                .setEmoji(CLASS_EMOJIS[cls as CharacterClass])
                        )
                    );

                const row1 = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(guildSelect);
                const row2 = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(classSelect);

                await interaction.reply({
                    content: 'Please select your **Guild** and **Class** to sign up:',
                    components: [row1, row2],
                    ephemeral: true
                });
            }
        }

        // --- 4. String Select Menus (Signup Logic) ---
        // Note: The structure here expects the user to select both, or maybe just one? 
        // Discord interactions are independent events.
        // Option A: We need a "Submit" button? No, user wants it easy.
        // Option B: Two-step process, or independent store?
        // Limitation: If I send two menus, I get two separate interactions when used.
        // Best approach for this UX: State persistence or "Select Guild, then Select Class, then Done".
        // OR: Since we can't easily share state between two independent menu interactions in ephemeral without DB:
        // Let's use a "Partial Signup" DB approach? Or just allow them to pick independently and update the DB row.
        // IF a user picks Guild, we update (or insert with null class).
        // IF a user picks Class, we update (or insert with null guild).
        // BUT we need both to display properly.
        // Let's try: Update DB on each selection, and warn if incomplete.
        else if (interaction.isStringSelectMenu()) {
            if (interaction.customId.startsWith('signup_guild_') || interaction.customId.startsWith('signup_class_')) {
                const isGuildSelect = interaction.customId.startsWith('signup_guild_');
                const readyCheckId = interaction.customId.replace(isGuildSelect ? 'signup_guild_' : 'signup_class_', '');
                const value = interaction.values[0];

                // Permission Check (Is Participant?)
                if (interaction.guildId) {
                    const settings = db.prepare('SELECT * FROM settings WHERE guild_id = ?').get(interaction.guildId) as GuildSettings | undefined;
                    if (settings?.participant_role_ids) {
                        const member = await interaction.guild?.members.fetch(interaction.user.id);
                        let allowedRoles: string[] = [];
                        try {
                            if (settings.participant_role_ids.startsWith('[')) {
                                allowedRoles = JSON.parse(settings.participant_role_ids);
                            } else {
                                allowedRoles = [settings.participant_role_ids];
                            }
                            const hasRole = allowedRoles.some(roleId => member?.roles.cache.has(roleId));
                            if (!hasRole) {
                                await interaction.reply({ content: 'You do not have permission to sign up.', ephemeral: true });
                                return;
                            }
                        } catch (e) {
                            console.error(e);
                        }
                    }
                }

                // Check active status
                const readyCheck = db.prepare('SELECT * FROM readychecks WHERE id = ?').get(readyCheckId) as ReadyCheck;
                if (!readyCheck || readyCheck.status !== 'active') {
                    await interaction.reply({ content: 'This readycheck is not active.', ephemeral: true });
                    return;
                }

                // Upsert Signup with partial data
                // We first need to see if a row exists to preserve the other field
                const existingSignup = db.prepare('SELECT * FROM signups WHERE user_id = ? AND readycheck_id = ?').get(interaction.user.id, readyCheckId) as any;

                let guildName = existingSignup?.guild_name || 'PENDING';
                let className = existingSignup?.class_name || 'PENDING';

                if (isGuildSelect) guildName = value;
                else className = value;

                const stmt = db.prepare(`
                    INSERT INTO signups (user_id, readycheck_id, guild_name, class_name)
                    VALUES (?, ?, ?, ?)
                    ON CONFLICT(user_id, readycheck_id) DO UPDATE SET
                    guild_name = excluded.guild_name,
                    class_name = excluded.class_name
                `);
                stmt.run(interaction.user.id, readyCheck.id, guildName, className);

                // Feedback
                let feedback = '';
                if (guildName === 'PENDING') {
                    feedback = `Class set to **${className}**. Please select your **Guild**!`;
                } else if (className === 'PENDING') {
                    feedback = `Guild set to **${guildName}**. Please select your **Class**!`;
                } else {
                    feedback = `✅ Signed up: **${guildName}** - **${className}**`;
                }

                // Only update the public embed if BOTH are set
                if (guildName !== 'PENDING' && className !== 'PENDING') {
                    try {
                        const channel = await interaction.client.channels.fetch(readyCheck.channel_id);
                        if (channel && channel.isTextBased()) {
                            const message = await (channel as TextChannel).messages.fetch(readyCheck.message_id);
                            if (message) {
                                const newEmbed = generateReadyCheckEmbed(readyCheck);
                                await message.edit({ embeds: [newEmbed] });
                            }
                        }
                    } catch (e) { console.error('Embed update failed', e); }
                }

                await interaction.reply({ content: feedback, ephemeral: true });
            }
        }
    },
};
