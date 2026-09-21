import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType,
    WebhookClient,
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
 * Default embed.
 *
 * This is only used when the stock message is first created.
 * After that, the bot reads the existing embed and preserves
 * your Discohook design.
 */
function createDefaultEmbed(amount) {
    return {
        color: 0xd81cde,

        title: '💎 Cosmic Robux Stock',

        description:
            `### 🟢 ${formatRobux(amount)} Robux Available\n\n` +
            `📦 **Status:** ${amount > 0 ? 'In Stock' : 'Out of Stock'}`,

        footer: {
            text: 'Cosmic Market',
        },

        timestamp: new Date().toISOString(),
    };
}

/*
 * Update ONLY the stock information.
 *
 * Everything else from the Discohook embed stays intact.
 */
function updateStockEmbed(embeds, amount) {
    if (!embeds || embeds.length === 0) {
        return [createDefaultEmbed(amount)];
    }

    const embed = structuredClone(embeds[0]);

    const newStockText =
        `### 🟢 ${formatRobux(amount)} Robux Available\n\n` +
        `📦 **Status:** ${amount > 0 ? 'In Stock' : 'Out of Stock'}`;

    /*
     * Find our stock section if it still exists.
     */
    const stockRegex =
        /### 🟢 [\d,]+ Robux Available\n\n📦 \*\*Status:\*\* (?:In Stock|Out of Stock)/;

    if (typeof embed.description === 'string') {
        if (stockRegex.test(embed.description)) {
            embed.description = embed.description.replace(
                stockRegex,
                newStockText
            );
        } else {
            /*
             * If you completely changed the description in Discohook,
             * preserve it and add the stock underneath.
             */
            embed.description += `\n\n${newStockText}`;
        }
    } else {
        embed.description = newStockText;
    }

    embed.timestamp = new Date().toISOString();

    return [embed];
}

export default {
    data: new SlashCommandBuilder()
        .setName('robux')
        .setDescription('Manage the Robux stock')
        .setDefaultMemberPermissions(
            PermissionFlagsBits.ManageGuild
        )
        .setDMPermission(false)

        // =========================
        // /robux setup
        // =========================
        .addSubcommand(subcommand =>
            subcommand
                .setName('setup')
                .setDescription('Set up the Robux stock message')

                .addChannelOption(option =>
                    option
                        .setName('channel')
                        .setDescription(
                            'Channel where the stock will be displayed'
                        )
                        .addChannelTypes(
                            ChannelType.GuildText
                        )
                        .setRequired(true)
                )

                .addIntegerOption(option =>
                    option
                        .setName('amount')
                        .setDescription(
                            'Current amount of Robux in stock'
                        )
                        .setMinValue(0)
                        .setRequired(true)
                )
        )

        // =========================
        // /robux add
        // =========================
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Add Robux to the stock')

                .addIntegerOption(option =>
                    option
                        .setName('amount')
                        .setDescription(
                            'Amount of Robux to add'
                        )
                        .setMinValue(1)
                        .setRequired(true)
                )
        )

        // =========================
        // /robux remove
        // =========================
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription(
                    'Remove Robux from the stock'
                )

                .addIntegerOption(option =>
                    option
                        .setName('amount')
                        .setDescription(
                            'Amount of Robux to remove'
                        )
                        .setMinValue(1)
                        .setRequired(true)
                )
        )

        // =========================
        // /robux stock
        // =========================
        .addSubcommand(subcommand =>
            subcommand
                .setName('stock')
                .setDescription(
                    'Show the current Robux stock'
                )
        ),

    category: 'Economy',

    async execute(interaction) {
        const data = loadData();
        const guildId = interaction.guildId;
        const subcommand =
            interaction.options.getSubcommand();

        // =========================
        // PERMISSION
        // =========================

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

            /*
             * Create a webhook in the selected channel.
             *
             * The bot needs Manage Webhooks permission.
             */
            const webhook =
                await channel.createWebhook({
                    name: 'Cosmic Robux Stock',
                });

            const webhookClient =
                new WebhookClient({
                    id: webhook.id,
                    token: webhook.token,
                });

            /*
             * Send the initial stock embed through
             * the webhook.
             */
            const message =
                await webhookClient.send({
                    embeds: [
                        createDefaultEmbed(amount),
                    ],
                    wait: true,
                });

            /*
             * Save everything required to update the
             * same webhook message later.
             */
            data[guildId] = {
                amount,
                channelId: channel.id,
                messageId: message.id,

                webhookId: webhook.id,
                webhookToken: webhook.token,

                updatedAt: Date.now(),
            };

            saveData(data);

            return interaction.reply({
                content:
                    `✅ Robux stock has been set up in ${channel} with **${formatRobux(amount)} Robux**.\n\n` +
                    `🎨 The message is now ready to customize with Discohook.\n\n` +
                    `⚠️ Don't delete the webhook from the channel settings.`,
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

        if (
            !stock.webhookId ||
            !stock.webhookToken ||
            !stock.messageId
        ) {
            return interaction.reply({
                content:
                    '❌ This Robux stock was created with the old system. Please run `/robux setup` again.',
                ephemeral: true,
            });
        }

        const webhookClient =
            new WebhookClient({
                id: stock.webhookId,
                token: stock.webhookToken,
            });

        // =========================
        // GET CURRENT MESSAGE
        // =========================

        let message;

        try {
            message =
                await webhookClient.fetchMessage(
                    stock.messageId
                );
        } catch {
            return interaction.reply({
                content:
                    '❌ I could not find the Robux stock message. Please run `/robux setup` again.',
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

            const currentEmbeds =
                message.embeds.map(embed =>
                    embed.toJSON()
                );

            const updatedEmbeds =
                updateStockEmbed(
                    currentEmbeds,
                    stock.amount
                );

            await webhookClient.editMessage(
                stock.messageId,
                {
                    embeds: updatedEmbeds,
                }
            );

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

            const currentEmbeds =
                message.embeds.map(embed =>
                    embed.toJSON()
                );

            const updatedEmbeds =
                updateStockEmbed(
                    currentEmbeds,
                    stock.amount
                );

            await webhookClient.editMessage(
                stock.messageId,
                {
                    embeds: updatedEmbeds,
                }
            );

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
