# GuildWarBot

A Discord bot for managing Guild War readychecks and signups on private servers.

## Features
- **Role-based Permissions**: Configure Leader and Participant roles per server.
- **Interactive Signups**: Real-time updating embeds showing who is signed up.
- **Multi-Guild Support**: Run readychecks for specific alliances or guilds.
- **Persistence**: Active checks and settings are saved to a database.

## Setup

### Prerequisites
- Node.js 18+
- Discord Bot Token & Client ID

### Installation
1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file (see `.env.example`):
   ```env
   DISCORD_TOKEN=your_token_here
   CLIENT_ID=your_client_id_here
   ```
4. Register Slash Commands:
   ```bash
   npm run deploy-commands
   ```
5. Build and Start:
   ```bash
   npm run build
   npm start
   ```

## Deploying on Railway
1. Push this code to GitHub.
2. Connect your GitHub repo to Railway.
3. Add the `DISCORD_TOKEN` and `CLIENT_ID` variables in Railway settings.
4. **Important**: Create a persistent Volume and mount it to `/app` (or configure a custom specific path for the DB) to ensure `db.sqlite` is not lost on restart.
   - Alternatively, change `src/db.ts` to use a different path if you mount the volume elsewhere (e.g., `/data`).

## Commands
- `/setup`: (Admin) Configure roles and channel.
- `/readycheck`: (Leader) Start a check.
- `/signup`: (Participant) Join a check.
- `/remove`: (Leader) Remove a check.

## User Guide for Server Owners

### 1. Invite the Bot
[Click here to invite GuildWarBot](https://discord.com/oauth2/authorize?client_id=1467299566121652340&permissions=8&integration_type=0&scope=bot+applications.commands)

### 2. Initial Setup
Run the `/setup` command.
- **Leader Roles**: Select the roles allowed to start and remove readychecks (e.g., GM, Guild Leader). You can pick multiple.
- **Participant Roles**: Select the roles allowed to sign up for wars.
- **Channel**: (Optional) Set a default channel where readychecks will always be posted.

### 3. Starting a Readycheck
Run `/readycheck`.
- **war_name**: The title of the event (e.g., "Weekly GW").
- **guilds**: Comma-separated list of guilds (e.g., "Ace, Kings, Jokers").
- **start_time**: When it starts (Unix timestamp or "YYYY-MM-DD HH:MM").
  - *Tip*: Use a Unix timestamp for automatic timezone conversion for all users!

The bot will tag `@everyone` and create a signup post.

### 4. Signing Up
Users click the **"Sign Up"** button on the message.
- They privately select their **Guild** and **Class**.
- The public message updates instantly with the roster.

### 5. Managing
- Leaders can use `/remove` to delete a readycheck (either by ID or the active one in the channel).
