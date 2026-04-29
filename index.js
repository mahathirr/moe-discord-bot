const {
  Client,
  GatewayIntentBits,
  AttachmentBuilder,
  EmbedBuilder,
  Partials,
} = require('discord.js');

const {
  joinVoiceChannel,
  VoiceConnectionStatus,
} = require('@discordjs/voice');

const { createCanvas, loadImage } = require('canvas');
const path = require('path');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

const OWNER_ID = "420763883318411294";

// =========================
// CONFIG
// =========================
const CHANNELS = {
  welcome: "1467709738237296836",
  roles: "1467713722264059916",
};

const AUTO_ROLE_ID = "1458692176346091591";

const reactionRoles = {
  messageId: null,
  roles: {
    "🔴": "1467713693579218965",
    "🟡": "1467713696032755997",
    "🟠": "1467713696662028421",
    "🔵": "1467713699002187789",
    "🟢": "1467713701816696905",
    "🟣": "1467713705201635380",
    "🩷": "1468481788816130202",
  }
};

const cooldown = new Set();

// =========================
// AFK SYSTEM (STABLE FIX)
// =========================
let afkConnection = null;
let afkChannel = null;

async function connectAFK() {
  if (!afkChannel) return;

  try {
    const connection = joinVoiceChannel({
      channelId: afkChannel.id,
      guildId: afkChannel.guild.id,
      adapterCreator: afkChannel.guild.voiceAdapterCreator,
      selfDeaf: true,
      selfMute: true,
    });

    connection.on('stateChange', (_, newState) => {
      if (newState.status === VoiceConnectionStatus.Disconnected) {
        try { connection.destroy(); } catch {}
        setTimeout(connectAFK, 3000);
      }
    });

    connection.on('error', () => {
      try { connection.destroy(); } catch {}
      setTimeout(connectAFK, 5000);
    });

    afkConnection = connection;
    console.log("AFK connected 🔊");
  } catch (err) {
    console.log("AFK error:", err);
    setTimeout(connectAFK, 5000);
  }
}

// =========================
// READY
// =========================
client.once('ready', async () => {
  console.log("Bot ready 🔥");

  const channel = client.channels.cache.get(CHANNELS.roles);
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setTitle("🎨 Color Roles")
    .setDescription("Pick your color")
    .setColor("Blue");

  const msg = await channel.send({ embeds: [embed] });

  reactionRoles.messageId = msg.id;

  for (const emoji of Object.keys(reactionRoles.roles)) {
    await msg.react(emoji);
  }
});

// =========================
// COMMANDS
// =========================
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const channel = interaction.channel;

  // =========================
  // CLEAR (UNCHANGED)
  // =========================
  if (interaction.commandName === 'clear') {
    if (interaction.user.id !== OWNER_ID) {
      return interaction.reply({ content: "❌ no access", flags: 64 });
    }

    const input = interaction.options.getString('amount');

    try {
      await interaction.deferReply({ flags: 64 });

      if (input === 'all') {
        let deleted = 0;

        while (true) {
          const msgs = await channel.messages.fetch({ limit: 100 });
          if (!msgs.size) break;

          const deletable = msgs.filter(
            m => Date.now() - m.createdTimestamp < 14 * 24 * 60 * 60 * 1000
          );

          if (!deletable.size) break;

          await channel.bulkDelete(deletable, true);
          deleted += deletable.size;

          if (msgs.size < 100) break;
        }

        return interaction.editReply(`✅ deleted ${deleted} messages`);
      }

      const amount = parseInt(input);
      if (isNaN(amount)) {
        return interaction.editReply("❌ invalid number");
      }

      const msgs = await channel.messages.fetch({ limit: 100 });

      const filtered = msgs
        .filter(m => !m.pinned)
        .first(amount);

      if (!filtered.length) {
        return interaction.editReply("❌ no messages found");
      }

      await channel.bulkDelete(filtered, true);

      return interaction.editReply(`✅ deleted ${filtered.length} messages`);

    } catch (err) {
      console.log(err);
      return interaction.editReply("❌ error");
    }
  }

  // =========================
  // AFK (FIXED ENTRY)
  // =========================
  if (interaction.commandName === 'afk') {
    const vc = interaction.member.voice.channel;

    if (!vc) {
      return interaction.reply({ content: "join voice first", flags: 64 });
    }

    afkChannel = vc;
    await connectAFK();

    return interaction.reply({
      content: "AFK MODE ACTIVE 🔊 (stable)",
      flags: 64,
    });
  }
});

// =========================
// AUTO ROLE
// =========================
client.on('guildMemberAdd', async (member) => {
  try {
    const role = member.guild.roles.cache.get(AUTO_ROLE_ID);
    if (role) await member.roles.add(role);
  } catch {}
});

// =========================
// MEMBER COUNT
// =========================
async function getHumanCount(guild) {
  try {
    const members = await guild.members.fetch();
    return members.filter(m => !m.user.bot).size;
  } catch {
    return guild.memberCount;
  }
}

// =========================
// WELCOME IMAGE
// =========================
client.on('guildMemberAdd', async (member) => {
  const channel = member.guild.channels.cache.get(CHANNELS.welcome);
  if (!channel) return;

  const humanCount = await getHumanCount(member.guild);

  const canvas = createCanvas(1000, 400);
  const ctx = canvas.getContext('2d');

  const bgPath = path.join(__dirname, 'bg.jpg');

  let bgImage;
  try {
    bgImage = await loadImage(bgPath);
  } catch {
    return;
  }

  const scale = Math.max(
    canvas.width / bgImage.width,
    canvas.height / bgImage.height
  );

  ctx.drawImage(
    bgImage,
    (canvas.width - bgImage.width * scale) / 2,
    (canvas.height - bgImage.height * scale) / 2,
    bgImage.width * scale,
    bgImage.height * scale
  );

  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const avatar = await loadImage(
    member.user.displayAvatarURL({ extension: 'png', size: 256 })
  );

  ctx.beginPath();
  ctx.arc(500, 145, 85, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(avatar, 415, 60, 170, 170);

  ctx.textAlign = 'center';

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 36px Sans';
  ctx.fillText(`${member.user.username} joined`, 500, 285);

  ctx.fillStyle = '#bbb';
  ctx.font = '22px Sans';
  ctx.fillText(`Member #${humanCount}`, 500, 325);

  const attachment = new AttachmentBuilder(canvas.toBuffer(), {
    name: 'welcome.png'
  });

  channel.send({ files: [attachment] });
});

// =========================
// REACTION ROLE ADD
// =========================
client.on('messageReactionAdd', async (reaction, user) => {
  try {
    if (user.bot) return;

    const key = `${user.id}-${reaction.message.id}`;
    if (cooldown.has(key)) return;

    cooldown.add(key);
    setTimeout(() => cooldown.delete(key), 600);

    if (reaction.partial) await reaction.fetch();
    if (reaction.message.partial) await reaction.message.fetch();

    if (reaction.message.id !== reactionRoles.messageId) return;

    const roleId = reactionRoles.roles[reaction.emoji.name];
    if (!roleId) return;

    const member = await reaction.message.guild.members.fetch(user.id);

    for (const id of Object.values(reactionRoles.roles)) {
      if (member.roles.cache.has(id)) {
        await member.roles.remove(id);
      }
    }

    const role = reaction.message.guild.roles.cache.get(roleId);
    if (role) await member.roles.add(role);

  } catch (err) {
    console.log(err);
  }
});

// =========================
// REACTION REMOVE
// =========================
client.on('messageReactionRemove', async (reaction, user) => {
  if (user.bot) return;

  if (reaction.partial) await reaction.fetch();
  if (reaction.message.partial) await reaction.message.fetch();

  if (reaction.message.id !== reactionRoles.messageId) return;

  const roleId = reactionRoles.roles[reaction.emoji.name];
  if (!roleId) return;

  const member = await reaction.message.guild.members.fetch(user.id);
  const role = reaction.message.guild.roles.cache.get(roleId);

  if (role) await member.roles.remove(role);
});

// =========================
// LOGIN
// =========================
client.login(process.env.TOKEN);
