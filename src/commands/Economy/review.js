import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
} from 'discord.js';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REVIEW_ROLE_ID = '1551509893947850835';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.join(__dirname, '../../../data');
const dataFile = path.join(dataDir, 'reviews.json');

function loadReviews() {
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    if (!fs.existsSync(dataFile)) {
        fs.writeFileSync(dataFile, '{}');
    }

    try {
        return JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    } catch {
        return {};
    }
}

function saveReviews(data) {
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
}

export default {
    data: new SlashCommandBuilder()
        .setName('review')
        .setDescription('Leave a review')
        .addIntegerOption(option =>
            option
                .setName('stars')
                .setDescription('Choose your rating')
                .setMinValue(1)
                .setMaxValue(5)
                .setRequired(true)
        ),

    category: 'Economy',

    async execute(interaction) {
        if (!interaction.guild) {
            return interaction.reply({
                content: 'This command can only be used in a server.',
                ephemeral: true,
            });
        }

        const isAdmin = interaction.member.permissions.has(
            PermissionFlagsBits.Administrator
        );

        const hasReviewRole =
            interaction.member.roles.cache.has(REVIEW_ROLE_ID);

        if (!isAdmin && !hasReviewRole) {
            return interaction.reply({
                content: 'You do not have permission to leave a review.',
                ephemeral: true,
            });
        }

        const reviews = loadReviews();
        const guildId = interaction.guild.id;
        const userId = interaction.user.id;

        if (!reviews[guildId]) {
            reviews[guildId] = [];
        }

        // Customers can only review once
        if (!isAdmin && reviews[guildId].includes(userId)) {
            return interaction.reply({
                content: 'You have already submitted a review.',
                ephemeral: true,
            });
        }

        const stars = interaction.options.getInteger('stars');

        const embed = new EmbedBuilder()
            .setColor(0xd81cde)
            .setDescription(
                `${'⭐'.repeat(stars)}\n\n` +
                `**${interaction.user.username}**\n` +
                `Reviewed by ${interaction.user}`
            );

        await interaction.reply({
            embeds: [embed],
        });

        // Only customers are saved as having reviewed.
        // Admins can review unlimited times.
        if (!isAdmin) {
            reviews[guildId].push(userId);
            saveReviews(reviews);
        }
    },
};
