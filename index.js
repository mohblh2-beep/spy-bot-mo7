require("dotenv").config();
const express = require("express");

const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder
} = require("discord.js");

const { SPY_MANAGER_ROLE_ID, VOTE_CHANNEL_ID } = require("./config");
const { getSpyCount, shuffle } = require("./utils");

// ================= EXPRESS (Render FIX) =================
const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("Spy Bot is running");
});

app.listen(PORT, () => {
  console.log("🌐 Web server started");
});

// ================= CLIENT =================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ],
  partials: ["CHANNEL"]
});

// ================= GAME STATE =================
let players = [];
let spies = [];
let votes = {};
let votedBy = {};
let word = null;
let waitingManager = null;
let gameStarted = false;

// ================= START BOT =================
client.once("clientReady", () => {
  console.log(`🤖 Logged as ${client.user.tag}`);
});

// ================= +spy =================
client.on("messageCreate", async (message) => {
  if (message.content !== "+spy") return;

  players = [];
  spies = [];
  votes = {};
  votedBy = {};
  word = null;
  gameStarted = false;

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("join").setLabel("🟢 Join").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("start").setLabel("▶️ Start").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("vote_start").setLabel("🗳️ Vote").setStyle(ButtonStyle.Secondary)
  );

  message.channel.send({
    content: "🎮 Spy Game Ready!",
    components: [row]
  });
});

// ================= INTERACTIONS =================
client.on("interactionCreate", async (interaction) => {

  if (!interaction.isButton() && !interaction.isStringSelectMenu()) return;

  // JOIN
  if (interaction.customId === "join") {

    if (!players.includes(interaction.user.id)) {
      players.push(interaction.user.id);
    }

    return interaction.reply({
      content: `✅ Joined | Players: ${players.length}`,
      ephemeral: true
    });
  }

  // START
  if (interaction.customId === "start") {

    if (!interaction.member.roles.cache.has(SPY_MANAGER_ROLE_ID)) {
      return interaction.reply({ content: "❌ Manager only", ephemeral: true });
    }

    if (players.length < 3) {
      return interaction.reply({ content: "❌ Min 3 players", ephemeral: true });
    }

    gameStarted = true;
    waitingManager = interaction.user.id;

    const manager = await client.users.fetch(interaction.user.id);
    manager.send("🎯 اكتب الكلمة هنا في DM");

    return interaction.reply({
      content: "📩 Check DM",
      ephemeral: true
    });
  }

  // VOTE START (MANAGER ONLY)
  if (interaction.customId === "vote_start") {

    if (!interaction.member.roles.cache.has(SPY_MANAGER_ROLE_ID)) {
      return interaction.reply({ content: "❌ Manager only", ephemeral: true });
    }

    const menu = new StringSelectMenuBuilder()
      .setCustomId("vote_menu")
      .setPlaceholder("🗳️ Choose a player")
      .addOptions(
        players.slice(0, 20).map(id => {
          const user = client.users.cache.get(id);
          return {
            label: user ? user.username : "Player",
            value: id
          };
        })
      );

    const row = new ActionRowBuilder().addComponents(menu);

    const channel = interaction.guild.channels.cache.get(VOTE_CHANNEL_ID);

    channel.send({
      content: "🗳️ Vote Started",
      components: [row]
    });

    return interaction.reply({
      content: "🗳️ Vote sent",
      ephemeral: true
    });
  }

  // VOTE SELECT MENU
  if (interaction.customId === "vote_menu") {

    const voter = interaction.user.id;
    const target = interaction.values[0];

    if (votedBy[voter]) {
      return interaction.reply({
        content: "❌ You already voted",
        ephemeral: true
      });
    }

    votedBy[voter] = target;
    votes[target] = (votes[target] || 0) + 1;

    return interaction.reply({
      content: `🗳️ Voted for <@${target}>`,
      ephemeral: true
    });
  }
});

// ================= DM WORD =================
client.on("messageCreate", async (message) => {

  if (message.guild) return;
  if (message.author.id !== waitingManager) return;

  word = message.content;
  waitingManager = null;

  const spyCount = getSpyCount(players.length);
  spies = shuffle([...players]).slice(0, spyCount);

  for (let id of players) {
    const user = await client.users.fetch(id);

    if (spies.includes(id)) {
      await user.send("🕵️ You are SPY!");
    } else {
      await user.send(`🎯 Word: ${word}`);
    }
  }

  await message.author.send(`✅ Game started | Spy count: ${spyCount}`);
});

// ================= END GAME =================
client.on("messageCreate", async (message) => {

  if (message.content !== "+end") return;

  if (!message.member.roles.cache.has(SPY_MANAGER_ROLE_ID)) {
    return message.reply("❌ Manager only");
  }

  let max = 0;
  let loser = null;

  for (let id in votes) {
    if (votes[id] > max) {
      max = votes[id];
      loser = id;
    }
  }

  message.channel.send(
    loser
      ? `🗳️ Most voted: <@${loser}> (${max})`
      : "❌ No votes"
  );

  players = [];
  spies = [];
  votes = {};
  votedBy = {};
  word = null;
  gameStarted = false;
  waitingManager = null;

  message.channel.send("🔄 Reset done");
});

client.login(process.env.TOKEN);