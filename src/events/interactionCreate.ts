
import { Events, Interaction, ComponentType } from 'discord.js';
import { db } from '../database/db';

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction: Interaction) {
        // Handle Slash Commands
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

        // Handle Role Select Menus for Setup
        else if (interaction.isRoleSelectMenu()) {
            if (interaction.customId === 'setup_leader_roles' || interaction.customId === 'setup_participant_roles') {
                if (!interaction.guildId) return;

                const column = interaction.customId === 'setup_leader_roles' ? 'leader_role_ids' : 'participant_role_ids';
                const selectedRoleIds = interaction.values; // Array of role IDs

                try {
                    // Upsert mechanism (SQLite specific)
                    // We need to ensure the row exists first or insert it
                    // Simple way: Insert OR IGNORE, then UPDATE
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
    },
};
