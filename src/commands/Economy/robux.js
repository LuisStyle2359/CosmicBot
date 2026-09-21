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

// ==========================================
// STORAGE
// ==========================================

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
        return JSON.parse(
            fs.readFileSync(dataFile, 'utf8')
        );
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

// ==========================================
// HELPERS
// ==========================================

function formatRobux(amount) {
    return Number(amount).toLocaleString('en-US');
}

function createDefaultEmbed(amount) {
    return {
        color: 0xd81cde,

        title: '💎 Cosmic Robux Stock',

        description:
            `### 🟢 ${formatRobux(amount)} Robux Available\n\n` +
            `📦 **Status:** ${
                amount > 0
                    ? 'In Stock'
                    : 'Out of Stock'
            }`,

        footer: {
            text: 'Cosmic Market',
        },

        timestamp: new Date().toISOString(),
    };
}

function updateStockEmbed(embeds, amount) {
    if (!embeds || embeds.length === 0) {
        return [createDefaultEmbed(amount)];
    }

    const embed = structuredClone(embeds[0]);

    const newStockText =
        `### 🟢 ${formatRobux(amount)} Robux Available\n\n` +
        `📦 **Status:** ${
            amount > 0
                ? 'In Stock'
                : 'Out of Stock'
        }`;

    const stockRegex =
        /### 🟢 [\d,]+ Robux Available\n\n📦 \*\*Status:\*\* (?:In Stock|Out of Stock)/;

    if (typeof embed.description === 'string') {
        if (stockRegex.test(embed.description)) {
            embed.description =
                embed.description.replace(
                    stockRegex,
                    newStockText
                );
        } else {
            embed.description +=
                `\n\n${newStockText}`;
        }
    } else {
        embed.description = newStockText;
    }

    embed.timestamp =
        new Date().toISOString();

    return [embed];
}

// ==========================================
// COMMAND
// ==========================================

export default {
    data: new SlashCommandBuilder()
        .setName('robux')
        .setDescription('Manage the Robux stock')
        .setDefaultMemberPermissions(
            PermissionFlagsBits.ManageGuild
        )
        .setDMPermission(false)

        // ==================================
        // /robux setup
        // ==================================

        .addSubcommand(subcommand =>
            subcommand
                .setName('setup')
                .setDescription(
                    'Set up the Robux stock'
                )

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
                            'Current amount of Robux'
                        )
                        .setMinValue(0)
                        .setRequired(true)
                )
        )

        // ==================================
        // /robux add
        // ==================================

        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription(
                    'Add Robux to the stock'
                )

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

        // ==================================
        // /robux remove
        // ==================================

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

        // ==================================
        // /robux stock
        // ==================================

        .addSubcommand(subcommand =>
            subcommand
                .setName('stock')
                .setDescription(
                    'Show the current Robux stock'
                )
        )

        // ==================================
        // /robux link
        // ==================================

        .addSubcommand(subcommand =>
            subcommand
                .setName('link')
                .setDescription(
                    'Show the Robux webhook link'
                )
        ),

    category: 'Economy',

    // ==========================================
    // EXECUTE
    // ==========================================

    async execute(interaction) {
        const data = loadData();

        const guildId =
            interaction.guildId;

        const subcommand =
            interaction.options.getSubcommand();

        // ======================================
        // ADMIN ONLY: /robux link
        // ======================================

        if (subcommand === 'link') {
            if (
                !interaction.memberPermissions?.has(
                    PermissionFlagsBits.Administrator
                )
            ) {
                return interaction.reply({
                    content:
                        '❌ Only administrators can use `/robux link`.',
                    ephemeral: true,
                });
            }

            const stock =
                data[guildId];

            if (!stock) {
                return interaction.reply({
                    content:
                        '❌ Robux stock has not been set up yet.\nUse `/robux setup` first.',
                    ephemeral: true,
                });
            }

            if (!stock.webhookUrl) {
                return interaction.reply({
                    content:
                        '❌ No webhook URL was found. Please run `/robux setup` again.',
                    ephemeral: true,
                });
            }

            return interaction.reply({
                content:
                    `🔗 **Robux Webhook URL:**\n\n` +
                    `\`${stock.webhookUrl}\`\n\n` +
                    `⚠️ **Keep this URL private!**`,
                ephemeral: true,
            });
        }

        // ======================================
        // NORMAL PERMISSION CHECK
        // ======================================

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

        // ======================================
        // SETUP
        // ======================================

        if (subcommand === 'setup') {
            const channel =
                interaction.options.getChannel(
                    'channel'
                );

            const amount =
                interaction.options.getInteger(
                    'amount'
                );

            try {
                // Create webhook
                const webhook =
                    await channel.createWebhook({
                        name:
                            'Cosmic Robux Stock',
                    });

                // Webhook client
                const webhookClient =
                    new WebhookClient({
                        id: webhook.id,
                        token: webhook.token,
                    });

                // Send stock message
                const message =
                    await webhookClient.send({
                        embeds: [
                            createDefaultEmbed(
                                amount
                            ),
                        ],
                        wait: true,
                    });

                // Webhook URL
                const webhookUrl =
                    `https://discord.com/api/webhooks/${webhook.id}/${webhook.token}`;

                // Save data
                data[guildId] = {
                    amount,
                    channelId:
                        channel.id,
                    messageId:
                        message.id,
                    webhookId:
                        webhook.id,
                    webhookToken:
                        webhook.token,
                    webhookUrl,
                    updatedAt:
                        Date.now(),
                };

                saveData(data);

                return interaction.reply({
                    content:
                        `✅ **Robux stock successfully created!**\n\n` +
                        `📦 Stock: **${formatRobux(
                            amount
                        )} Robux**\n` +
                        `📍 Channel: ${channel}\n\n` +
                        `🔗 **Webhook URL:**\n` +
                        `\`${webhookUrl}\`\n\n` +
                        `🎨 You can now customize the embed with Discohook.\n\n` +
                        `⚠️ **Never share this webhook URL publicly.**`,
                    ephemeral: true,
                });

            } catch (error) {
                console.error(
                    '[Robux] Setup error:',
                    error
                );

                return interaction.reply({
                    content:
                        '❌ I could not create the webhook.\n\nMake sure the bot has **Manage Webhooks** permission in the selected channel.',
                    ephemeral: true,
                });
            }
        }

        // ======================================
        // LOAD STOCK
        // ======================================

        const stock =
            data[guildId];

        if (!stock) {
            return interaction.reply({
                content:
                    '❌ Robux stock has not been set up yet.\nUse `/robux setup` first.',
                ephemeral: true,
            });
        }

        // ======================================
        // CHECK WEBHOOK DATA
        // ======================================

        if (
            !stock.webhookId ||
            !stock.webhookToken ||
            !stock.messageId
        ) {
            return interaction.reply({
                content:
                    '❌ This Robux stock was created with an older version.\n\nPlease run `/robux setup` again.',
                ephemeral: true,
            });
        }

        // ======================================
        // WEBHOOK CLIENT
        // ======================================

        const webhookClient =
            new WebhookClient({
                id:
                    stock.webhookId,
                token:
                    stock.webhookToken,
            });

        let message;

        try {
            message =
                await webhookClient.fetchMessage(
                    stock.messageId
                );

        } catch (error) {
            console.error(
                '[Robux] Fetch message error:',
                error
            );

            return interaction.reply({
                content:
                    '❌ I could not find the Robux stock message.\n\nPlease run `/robux setup` again.',
                ephemeral: true,
            });
        }

        // ======================================
        // ADD
        // ======================================

        if (subcommand === 'add') {
            const amount =
                interaction.options.getInteger(
                    'amount'
                );

            stock.amount += amount;

            stock.updatedAt =
                Date.now();

            const currentEmbeds =
                message.embeds.map(
                    embed =>
                        embed.toJSON()
                );

            const updatedEmbeds =
                updateStockEmbed(
                    currentEmbeds,
                    stock.amount
                );

            try {
                await webhookClient.editMessage(
                    stock.messageId,
                    {
                        embeds:
                            updatedEmbeds,
                    }
                );

            } catch (error) {
                console.error(
                    '[Robux] Edit error:',
                    error
                );

                return interaction.reply({
                    content:
                        '❌ I could not update the stock message.',
                    ephemeral: true,
                });
            }

            saveData(data);

            return interaction.reply({
                content:
                    `✅ Added **${formatRobux(
                        amount
                    )} Robux**.\n\n` +
                    `💰 New stock: **${formatRobux(
                        stock.amount
                    )} Robux**`,
                ephemeral: true,
            });
        }

        // ======================================
        // REMOVE
        // ======================================

        if (subcommand === 'remove') {
            const amount =
                interaction.options.getInteger(
                    'amount'
                );

            if (
                amount > stock.amount
            ) {
                return interaction.reply({
                    content:
                        `❌ You only have **${formatRobux(
                            stock.amount
                        )} Robux** in stock.`,
                    ephemeral: true,
                });
            }

            stock.amount -= amount;

            stock.updatedAt =
                Date.now();

            const currentEmbeds =
                message.embeds.map(
                    embed =>
                        embed.toJSON()
                );

            const updatedEmbeds =
                updateStockEmbed(
                    currentEmbeds,
                    stock.amount
                );

            try {
                await webhookClient.editMessage(
                    stock.messageId,
                    {
                        embeds:
                            updatedEmbeds,
                    }
                );

            } catch (error) {
                console.error(
                    '[Robux] Edit error:',
                    error
                );

                return interaction.reply({
                    content:
                        '❌ I could not update the stock message.',
                    ephemeral: true,
                });
            }

            saveData(data);

            return interaction.reply({
                content:
                    `✅ Removed **${formatRobux(
                        amount
                    )} Robux**.\n\n` +
                    `💰 New stock: **${formatRobux(
                        stock.amount
                    )} Robux**`,
                ephemeral: true,
            });
        }

        // ======================================
        // STOCK
        // ======================================

        if (subcommand === 'stock') {
            return interaction.reply({
                embeds:
                    message.embeds.map(
                        embed =>
                            embed.toJSON()
                    ),
                ephemeral: true,
            });
        }
    },
};
