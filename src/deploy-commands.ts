
import { REST, Routes } from 'discord.js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const commands: any[] = [];
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.ts') || file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
        commands.push(command.data.toJSON());
    } else {
        console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
    }
}

// Construct and prepare an instance of the REST module
const rest = new REST().setToken(process.env.DISCORD_TOKEN!);

// and deploy your commands!
(async () => {
    try {
        console.log(`Started refreshing ${commands.length} application (/) commands.`);

        // The put method is used to fully refresh all commands in the guild with the current set
        // Note: For global commands, use Routes.applicationCommands(clientId)
        // For development, guild commands update instantly, global takes 1h.
        // We will use Global here as per request for general bot use, but warn about delay.
        const clientId = process.env.CLIENT_ID!;

        await rest.put(
            Routes.applicationCommands(clientId),
            { body: commands },
        );

        console.log(`Successfully reloaded ${commands.length} application (/) commands.`);
    } catch (error) {
        console.error(error);
    }
})();
