import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
} from 'discord.js';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REVIEW_ROLE_ID = '1551509893947850835';
const REVIEW_CHANNEL_ID = '1551509896246206544';

const REVIEW_IMAGE_URL =
    'https://cdn.discordapp.com/attachments/1551509897345237054/1551595003162271744/Review_20260921_160421_0000.png?ex=6ab28af3&is=6ab13973&hm=151bb99cc5f3fce0955d5a0a57c9da0dae03d9fdb46570cd64ae714c95acdbc9&';

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

        // ★★★★★ = 5
        // ★★★★☆ = 4
        // ★★★☆☆ = 3
        // ★★☆☆☆ = 2
        // ★☆☆☆☆ = 1
        const starRating = '★'.repeat(stars) + '☆'.repeat(5 - stars);

        const embed = new EmbedBuilder()
            .setColor(0xd81cde)
            .setDescription(
                `${starRating}\n\n` +
                `**Reviewed by:** ${interaction.user}`
            )
            .setImage(REVIEW_IMAGE_URL);

        let reviewChannel;

        try {
            reviewChannel = await interaction.guild.channels.fetch(
                REVIEW_CHANNEL_ID
            );
        } catch (error) {
            console.error('[Review] Failed to fetch channel:', error);

            return interaction.reply({
                content: 'The review channel could not be found.',
                ephemeral: true,
            });
        }

        if (!reviewChannel || !reviewChannel.isTextBased()) {
            return interaction.reply({
                content: 'The review channel is invalid.',
                ephemeral: true,
            });
        }

        try {
            await reviewChannel.send({
                embeds: [embed],
            });
        } catch (error) {
            console.error('[Review] Failed to send review:', error);

            return interaction.reply({
                content:
                    'I could not send your review. Please check my permissions in the review channel.',
                ephemeral: true,
            });
        }

        // Customers are permanently marked as reviewed.
        // Admins can review unlimited times.
        if (!isAdmin) {
            reviews[guildId].push(userId);
            saveReviews(reviews);
        }

        return interaction.reply({
            content: 'Your review has been submitted!',
            ephemeral: true,
        });
    },
};
