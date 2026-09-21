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
    return Number(amount).toLocaleString('de-DE');
}

function getStockText(amount) {
    return `Robux Available: ${formatRobux(amount)}`;
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

        // /robux setup
        .addSubcommand(subcommand =>
            subcommand
                .setName('setup')
                .setDescription('Set up the Robux stock')
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

        // /robux add
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

        // /robux remove
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

        // /robux stock
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

        // ==========================================
        // PERMISSION CHECK
        // ==========================================

        if (
            !interaction.memberPermissions?.has(
                PermissionFlagsBits.ManageGuild
            )
        ) {
            return interaction.reply({
                content:
                    'You do not have permission to manage the Robux stock.',
                ephemeral: true,
            });
        }

        // ==========================================
        // SETUP
        // ==========================================

        if (subcommand === 'setup') {
            const channel =
                interaction.options.getChannel('channel');

            const amount =
                interaction.options.getInteger('amount');

            try {
                const message =
                    await channel.send(
                        getStockText(amount)
                    );

                data[guildId] = {
                    amount,
                    channelId: channel.id,
                    messageId: message.id,
                    updatedAt: Date.now(),
                };

                saveData(data);

                return interaction.reply({
                    content:
                        `Robux stock set to ${formatRobux(amount)} in ${channel}.`,
                    ephemeral: true,
                });

            } catch (error) {
                console.error(
                    '[Robux] Setup error:',
                    error
                );

                return interaction.reply({
                    content:
                        'I could not send the stock message. Make sure I have Send Messages permission in that channel.',
                    ephemeral: true,
                });
            }
        }

        // ==========================================
        // LOAD STOCK
        // ==========================================

        const stock = data[guildId];

        if (!stock) {
            return interaction.reply({
                content:
                    'Robux stock has not been set up yet. Use /robux setup first.',
                ephemeral: true,
            });
        }

        // ==========================================
        // GET CHANNEL
        // ==========================================

        const channel =
            await interaction.guild.channels.fetch(
                stock.channelId
            );

        if (!channel) {
            return interaction.reply({
                content:
                    'The Robux stock channel could not be found. Please run /robux setup again.',
                ephemeral: true,
            });
        }

        // ==========================================
        // GET MESSAGE
        // ==========================================

        let message;

        try {
            message =
                await channel.messages.fetch(
                    stock.messageId
                );
        } catch (error) {
            console.error(
                '[Robux] Message fetch error:',
                error
            );

            return interaction.reply({
                content:
                    'The Robux stock message could not be found. Please run /robux setup again.',
                ephemeral: true,
            });
        }

        // ==========================================
        // ADD
        // ==========================================

        if (subcommand === 'add') {
            const amount =
                interaction.options.getInteger(
                    'amount'
                );

            stock.amount += amount;
            stock.updatedAt = Date.now();

            await message.edit(
                getStockText(stock.amount)
            );

            saveData(data);

            return interaction.reply({
                content:
                    `Added ${formatRobux(amount)} Robux. New stock: ${formatRobux(stock.amount)}.`,
                ephemeral: true,
            });
        }

        // ==========================================
        // REMOVE
        // ==========================================

        if (subcommand === 'remove') {
            const amount =
                interaction.options.getInteger(
                    'amount'
                );

            if (amount > stock.amount) {
                return interaction.reply({
                    content:
                        `You only have ${formatRobux(stock.amount)} Robux in stock.`,
                    ephemeral: true,
                });
            }

            stock.amount -= amount;
            stock.updatedAt = Date.now();

            await message.edit(
                getStockText(stock.amount)
            );

            saveData(data);

            return interaction.reply({
                content:
                    `Removed ${formatRobux(amount)} Robux. New stock: ${formatRobux(stock.amount)}.`,
                ephemeral: true,
            });
        }

        // ==========================================
        // STOCK
        // ==========================================

        if (subcommand === 'stock') {
            return interaction.reply({
                content:
                    getStockText(stock.amount),
                ephemeral: true,
            });
        }
    },
};
