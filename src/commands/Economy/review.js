import {
    SlashCommandBuilder,
    EmbedBuilder,
} from 'discord.js';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REVIEW_ROLE_ID = '1551509893947850835';
const PLUS_ROLE_ID = '1551509894069223464';
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

function getStars(amount) {
    return '★'.repeat(amount) + '☆'.repeat(5 - amount);
}

export default {
    data: new SlashCommandBuilder()
        .setName('review')
        .setDescription('Review commands')

        // /review normal
        .addSubcommand(subcommand =>
            subcommand
                .setName('normal')
                .setDescription('Leave a review')
                .addIntegerOption(option =>
                    option
                        .setName('stars')
                        .setDescription('Choose your rating')
                        .setMinValue(1)
                        .setMaxValue(5)
                        .setRequired(true)
                )
        )

        // /review plus
        .addSubcommand(subcommand =>
            subcommand
                .setName('plus')
                .setDescription('Create a review for another user')
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('User to display as the reviewer')
                        .setRequired(true)
                )
                .addIntegerOption(option =>
                    option
                        .setName('stars')
                        .setDescription('Choose the rating')
                        .setMinValue(1)
                        .setMaxValue(5)
                        .setRequired(true)
                )
        ),

    category: 'Economy',

    async execute(interaction) {
        if (!interaction.guild) {
            return interaction.reply({
                content: 'This command can only be used in a server.',
                ephemeral: true,
            });
        }

        const subcommand = interaction.options.getSubcommand();

        const reviews = loadReviews();
        const guildId = interaction.guild.id;

        if (!reviews[guildId]) {
            reviews[guildId] = [];
        }

        // =========================================================
        // /review plus
        // =========================================================

        if (subcommand === 'plus') {
            const hasPlusRole =
                interaction.member.roles.cache.has(PLUS_ROLE_ID);

            if (!hasPlusRole) {
                return interaction.reply({
                    content:
                        'You do not have permission to use this command.',
                    ephemeral: true,
                });
            }

            const targetUser = interaction.options.getUser('user');
            const stars = interaction.options.getInteger('stars');

            // Give target the customer role
            try {
                const member = await interaction.guild.members.fetch(
                    targetUser.id
                );

                if (!member.roles.cache.has(REVIEW_ROLE_ID)) {
                    await member.roles.add(REVIEW_ROLE_ID);
                }
            } catch (error) {
                console.error('[Review Plus] Role error:', error);

                return interaction.reply({
                    content:
                        'I could not give that user the customer role. Make sure I have Manage Roles and my bot role is above the customer role.',
                    ephemeral: true,
                });
            }

            // Mark target as having reviewed
            if (!reviews[guildId].includes(targetUser.id)) {
                reviews[guildId].push(targetUser.id);
                saveReviews(reviews);
            }

            let reviewChannel;

            try {
                reviewChannel = await interaction.guild.channels.fetch(
                    REVIEW_CHANNEL_ID
                );
            } catch (error) {
                console.error('[Review Plus] Channel error:', error);

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

            const embed = new EmbedBuilder()
                .setColor(0xd81cde)
                .setDescription(
                    `${getStars(stars)}\n\n` +
                    `**Reviewed by:** ${targetUser}`
                )
                .setImage(REVIEW_IMAGE_URL);

            try {
                await reviewChannel.send({
                    embeds: [embed],
                });
            } catch (error) {
                console.error('[Review Plus] Send error:', error);

                return interaction.reply({
                    content:
                        'I could not send the review. Check my permissions in the review channel.',
                    ephemeral: true,
                });
            }

            return interaction.reply({
                content:
                    `Fake review created for ${targetUser}. They have been given the customer role and can no longer submit another review.`,
                ephemeral: true,
            });
        }

        // =========================================================
        // /review normal
        // =========================================================

        if (subcommand === 'normal') {
            const isAdmin = interaction.member.permissions.has(
                'Administrator'
            );

            const hasReviewRole =
                interaction.member.roles.cache.has(REVIEW_ROLE_ID);

            if (!hasReviewRole && !isAdmin) {
                return interaction.reply({
                    content:
                        'You do not have permission to leave a review.',
                    ephemeral: true,
                });
            }

            const userId = interaction.user.id;

            // Customer can only review once
            if (!isAdmin && reviews[guildId].includes(userId)) {
                return interaction.reply({
                    content:
                        'You have already submitted a review.',
                    ephemeral: true,
                });
            }

            const stars = interaction.options.getInteger('stars');

            let reviewChannel;

            try {
                reviewChannel = await interaction.guild.channels.fetch(
                    REVIEW_CHANNEL_ID
                );
            } catch (error) {
                console.error('[Review] Channel error:', error);

                return interaction.reply({
                    content:
                        'The review channel could not be found.',
                    ephemeral: true,
                });
            }

            if (!reviewChannel || !reviewChannel.isTextBased()) {
                return interaction.reply({
                    content:
                        'The review channel is invalid.',
                    ephemeral: true,
                });
            }

            const embed = new EmbedBuilder()
                .setColor(0xd81cde)
                .setDescription(
                    `${getStars(stars)}\n\n` +
                    `**Reviewed by:** ${interaction.user}`
                )
                .setImage(REVIEW_IMAGE_URL);

            try {
                await reviewChannel.send({
                    embeds: [embed],
                });
            } catch (error) {
                console.error('[Review] Send error:', error);

                return interaction.reply({
                    content:
                        'I could not send your review. Please check my permissions in the review channel.',
                    ephemeral: true,
                });
            }

            // Save customer permanently
            // Admins can review unlimited times
            if (!isAdmin) {
                reviews[guildId].push(userId);
                saveReviews(reviews);
            }

            return interaction.reply({
                content:
                    'Your review has been submitted!',
                ephemeral: true,
            });
        }
    },
};
