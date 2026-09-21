import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType,
} from 'discord.js';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.join(__dirname, '../../../data');
const dataFile = path.join(dataDir, 'robux-stock.json');

function ensureStorage() {
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    if (!fs.existsSync(dataFile)) {
        fs.writeFileSync(dataFile, '{}');
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

/*
 * Creates the default embed.
 *
 * IMPORTANT:
 * After you customize the message through Discohook,
 * the bot will preserve the embed instead of rebuilding it.
 */
function createDefaultEmbed(stock) {
    return {
        color: 0xd81cde,
        title: '💎 Cosmic Robux Stock',
        description:
            `### 🟢 ${formatRobux(stock.amount)} Robux Available\n\n` +
            `📦 **Status:** ${stock.amount > 0 ? 'In Stock' : 'Out of Stock'}`,
        footer: {
            text: 'Cosmic Market',
        },
        timestamp: new Date().toISOString(),
    };
}

/*
 * Updates ONLY the stock information inside the existing embed.
 *
 * Everything else — title, color, images, fields, footer, etc.
 * — is preserved.
 */
function updateStockInEmbed(existingEmbeds, amount) {
    if (!existingEmbeds || existingEmbeds.length === 0) {
        return [createDefaultEmbed({
            amount,
        })];
    }

    const embed = structuredClone(existingEmbeds[0]);

    const stockText =
        `### 🟢 ${formatRobux(amount)} Robux Available\n\n` +
        `📦 **Status:** ${amount > 0 ? 'In Stock' : 'Out of Stock'}`;

    /*
     * If the description contains our old stock text,
     * replace it while preserving the rest of the description.
     */
    if (typeof embed.description === 'string') {
        const stockRegex =
            /### 🟢 [\d,]+ Robux Available\n\n📦 \*\*Status:\*\* (?:In Stock|Out of Stock)/;

        if (stockRegex.test(embed.description)) {
            embed.description = embed.description.replace(
                stockRegex,
                stockText
            );
        } else {
            /*
             * If Discohook changed the description completely,
             * don't destroy it. Add the current stock underneath.
             */
            embed.description =
                `${embed.description}\n\n${stockText}`;
        }
    } else {
        embed.description = stockText;
    }

    /*
     * Update Discord's timestamp so users can see
     * when the stock was changed.
     */
    embed.timestamp = new Date().toISOString();

    return [embed];
}

export default {
    data: new SlashCommandBuilder()
        .setName('robux')
        .setDescription('Manage the Robux stock')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setDMPermission(false)

        // /robux setup
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

        // /robux add
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

        // /robux remove
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

        // /robux stock
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

        // Permission check
        if (
            !interaction.memberPermissions?.has(
                PermissionFlagsBits.ManageGuild
            )
        ) {
            return interaction.reply({
                content:
                    '❌ You do not have permission to manage the Robux stock.',
                ephemeral: true,
            });
        }

        // =========================
        // SETUP
        // =========================

        if (subcommand === 'setup') {
            const channel =
                interaction.options.getChannel('channel');

            const amount =
                interaction.options.getInteger('amount');

            const stock = {
                amount,
                channelId: channel.id,
                messageId: null,
                updatedAt: Date.now(),
            };

            const message = await channel.send({
                embeds: [
                    createDefaultEmbed(stock),
                ],
            });

            stock.messageId = message.id;

            data[guildId] = stock;

            saveData(data);

            return interaction.reply({
                content:
                    `✅ Robux stock has been set up in ${channel} with **${formatRobux(amount)} Robux**.\n\n` +
                    `💡 You can now customize the embed using Discohook.`,
                ephemeral: true,
            });
        }

        // =========================
        // CHECK SETUP
        // =========================

        const stock = data[guildId];

        if (!stock) {
            return interaction.reply({
                content:
                    '❌ Robux stock has not been set up yet. Use `/robux setup` first.',
                ephemeral: true,
            });
        }

        // =========================
        // FIND CHANNEL
        // =========================

        const channel =
            await interaction.guild.channels
                .fetch(stock.channelId)
                .catch(() => null);

        if (!channel) {
            return interaction.reply({
                content:
                    '❌ I could not find the stock channel. Please run `/robux setup` again.',
                ephemeral: true,
            });
        }

        // =========================
        // FIND MESSAGE
        // =========================

        const message =
            await channel.messages
                .fetch(stock.messageId)
                .catch(() => null);

        if (!message) {
            return interaction.reply({
                content:
                    '❌ I could not find the stock message. Please run `/robux setup` again.',
                ephemeral: true,
            });
        }

        // =========================
        // ADD
        // =========================

        if (subcommand === 'add') {
            const amount =
                interaction.options.getInteger('amount');

            stock.amount += amount;
            stock.updatedAt = Date.now();

            /*
             * Get the CURRENT embed from Discord.
             *
             * This is what allows you to customize
             * the embed externally without the bot
             * resetting your design.
             */
            const updatedEmbeds =
                updateStockInEmbed(
                    message.embeds.map(embed =>
                        embed.toJSON()
                    ),
                    stock.amount
                );

            await message.edit({
                embeds: updatedEmbeds,
            });

            saveData(data);

            return interaction.reply({
                content:
                    `✅ Added **${formatRobux(amount)} Robux**.\n` +
                    `💰 New stock: **${formatRobux(stock.amount)} Robux**`,
                ephemeral: true,
            });
        }

        // =========================
        // REMOVE
        // =========================

        if (subcommand === 'remove') {
            const amount =
                interaction.options.getInteger('amount');

            if (amount > stock.amount) {
                return interaction.reply({
                    content:
                        `❌ You only have **${formatRobux(stock.amount)} Robux** in stock.`,
                    ephemeral: true,
                });
            }

            stock.amount -= amount;
            stock.updatedAt = Date.now();

            const updatedEmbeds =
                updateStockInEmbed(
                    message.embeds.map(embed =>
                        embed.toJSON()
                    ),
                    stock.amount
                );

            await message.edit({
                embeds: updatedEmbeds,
            });

            saveData(data);

            return interaction.reply({
                content:
                    `✅ Removed **${formatRobux(amount)} Robux**.\n` +
                    `💰 New stock: **${formatRobux(stock.amount)} Robux**`,
                ephemeral: true,
            });
        }

        // =========================
        // STOCK
        // =========================

        if (subcommand === 'stock') {
            return interaction.reply({
                embeds: message.embeds.map(embed =>
                    embed.toJSON()
                ),
                ephemeral: true,
            });
        }
    },
};
