require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');

if (!process.env.TOKEN || !process.env.CLIENT_ID || !process.env.GUILD_ID) {
  throw new Error("Missing env TOKEN / CLIENT_ID / GUILD_ID");
}

const commands = [
  // =========================
  // CLEAR COMMAND
  // =========================
  new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Clear messages (owner only)')
    .addStringOption(opt =>
      opt.setName('amount')
        .setDescription('messages amount or all')
        .setRequired(true)
    )
    .toJSON(),

  // =========================
  // AFK COMMAND
  // =========================
  new SlashCommandBuilder()
    .setName('afk')
    .setDescription('make bot join voice and stay 24/7')
    .toJSON()
];

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
  try {
    console.log("Deploying slash commands...");

    await rest.put(
      Routes.applicationGuildCommands(
        process.env.CLIENT_ID,
        process.env.GUILD_ID
      ),
      { body: commands }
    );

    console.log("Done ✅ slash commands registered");
  } catch (err) {
    console.error("Deploy error:", err);
  }
})();