import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType,
} from 'discord.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EmbedBuilder } from 'discord.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Storage file
const dataDir = path.join(__dirname, '../../../data');
const dataFile = path.join(dataDir, 'robux-stock.json');

function ensureStorage() {
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    if (!fs.existsSync(dataFile)) {
        fs.writeFileSync(
            dataFile,
            JSON.stringify({}, null, 2)
        );
    }
}

function loadData() {
    ensureStorage();

    try {
        return JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    } catch {
        return {};
    }
}

function saveData(data) {
    ensureStorage();

    fs.writeFileSync(
        dataFile,
        JSON.stringify(data, null, 2)
    );
}

function formatRobux(amount) {
    return Number(amount).toLocaleString('en-US');
}

function createStockEmbed(stock) {
    return new EmbedBuilder()
        .setColor('#d81cde')
        .setTitle('💎 Cosmic Robux Stock')
        .setDescription(
            `### 🟢 ${formatRobux(stock.amount)} Robux Available\n\n` +
            `📦 **Status:** ${stock.amount > 0 ? 'In Stock' : 'Out of Stock'}`
        )
        .addFields({
            name: '🔄 Last Updated',
            value: `<t:${Math.floor(stock.updatedAt / 1000)}:R>`,
            inline: true,
        })
        .setFooter({
            text: 'Cosmic Market',
        })
        .setTimestamp();
}

export default {
    data: new SlashCommandBuilder()
        .setName('robux')
        .setDescription('Manage the Robux stock')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setDMPermission(false)

        .addSubcommand(subcommand =>
            subcommand
                .setName('setup')
                .setDescription('Set up the Robux stock message')
                .addChannelOption(option =>
                    option
                        .setName('channel')
                        .setDescription('Channel where the stock will be displayed')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true)
                )
                .addIntegerOption(option =>
                    option
                        .setName('amount')
                        .setDescription('Current amount of Robux in stock')
                        .setMinValue(0)
                        .setRequired(true)
                )
        )

        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Add Robux to the stock')
                .addIntegerOption(option =>
                    option
                        .setName('amount')
                        .setDescription('Amount of Robux to add')
                        .setMinValue(1)
                        .setRequired(true)
                )
        )

        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Remove Robux from the stock')
                .addIntegerOption(option =>
                    option
                        .setName('amount')
                        .setDescription('Amount of Robux to remove')
                        .setMinValue(1)
                        .setRequired(true)
                )
        )

        .addSubcommand(subcommand =>
            subcommand
                .setName('stock')
                .setDescription('Show the current Robux stock')
        ),

    category: 'Economy',

    async execute(interaction) {
        const data = loadData();
        const guildId = interaction.guildId;
        const subcommand = interaction.options.getSubcommand();

        // Only server managers can use the commands
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
            return interaction.reply({
                content: '❌ You do not have permission to manage the Robux stock.',
                ephemeral: true,
            });
        }

        // =========================
        // SETUP
        // =========================

        if (subcommand === 'setup') {
            const channel = interaction.options.getChannel('channel');
            const amount = interaction.options.getInteger('amount');

            const stock = {
                amount,
                channelId: channel.id,
                messageId: null,
                updatedAt: Date.now(),
            };

            const message = await channel.send({
                embeds: [createStockEmbed(stock)],
            });

            stock.messageId = message.id;

            data[guildId] = stock;
            saveData(data);

            return interaction.reply({
                content: `✅ Robux stock has been set up in ${channel} with **${formatRobux(amount)} Robux**.`,
                ephemeral: true,
            });
        }

        // Check setup
        const stock = data[guildId];

        if (!stock) {
            return interaction.reply({
                content: '❌ Robux stock has not been set up yet. Use `/robux setup` first.',
                ephemeral: true,
            });
        }

        // =========================
        // FIND EXISTING MESSAGE
        // =========================

        const channel = await interaction.guild.channels
            .fetch(stock.channelId)
            .catch(() => null);

        if (!channel) {
            return interaction.reply({
                content: '❌ I could not find the stock channel. Please run `/robux setup` again.',
                ephemeral: true,
            });
        }

        const message = await channel.messages
            .fetch(stock.messageId)
            .catch(() => null);

        if (!message) {
            return interaction.reply({
                content: '❌ I could not find the stock message. Please run `/robux setup` again.',
                ephemeral: true,
            });
        }

        // =========================
        // ADD
        // =========================

        if (subcommand === 'add') {
            const amount = interaction.options.getInteger('amount');

            stock.amount += amount;
            stock.updatedAt = Date.now();

            saveData(data);

            await message.edit({
                embeds: [createStockEmbed(stock)],
            });

            return interaction.reply({
                content: `✅ Added **${formatRobux(amount)} Robux**.\nNew stock: **${formatRobux(stock.amount)} Robux**`,
                ephemeral: true,
            });
        }

        // =========================
        // REMOVE
        // =========================

        if (subcommand === 'remove') {
            const amount = interaction.options.getInteger('amount');

            if (amount > stock.amount) {
                return interaction.reply({
                    content: `❌ You only have **${formatRobux(stock.amount)} Robux** in stock.`,
                    ephemeral: true,
                });
            }

            stock.amount -= amount;
            stock.updatedAt = Date.now();

            saveData(data);

            await message.edit({
                embeds: [createStockEmbed(stock)],
            });

            return interaction.reply({
                content: `✅ Removed **${formatRobux(amount)} Robux**.\nNew stock: **${formatRobux(stock.amount)} Robux**`,
                ephemeral: true,
            });
        }

        // =========================
        // STOCK
        // =========================

        if (subcommand === 'stock') {
            return interaction.reply({
                embeds: [createStockEmbed(stock)],
                ephemeral: true,
            });
        }
    },
};
