import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
} from 'discord.js';

const REVIEW_ROLE_ID = '1551509893947850835';
const PRIMARY_COLOR = 0xd81cde;

function getStars(amount) {
    return '⭐'.repeat(amount);
}

function createReviewEmbed({ user, reviewer, stars, fake = false }) {
    return new EmbedBuilder()
        .setColor(PRIMARY_COLOR)
        .setDescription(
            `${getStars(stars)}\n\n` +
            `**${user.username}**\n` +
            `Reviewed by ${reviewer}`
        );
}

function canReview(member) {
    return (
        member.permissions.has(PermissionFlagsBits.Administrator) ||
        member.roles.cache.has(REVIEW_ROLE_ID)
    );
}

export default {
    data: new SlashCommandBuilder()
        .setName('review')
        .setDescription('Leave a review with a star rating')
        .addIntegerOption(option =>
            option
                .setName('stars')
                .setDescription('Your rating')
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

        if (!canReview(interaction.member)) {
            return interaction.reply({
                content: 'You do not have permission to leave a review.',
                ephemeral: true,
            });
        }

        const stars = interaction.options.getInteger('stars');

        const embed = createReviewEmbed({
            user: interaction.user,
            reviewer: interaction.user,
            stars,
        });

        await interaction.reply({
            embeds: [embed],
        });
    },

    /**
     * Used by the !review fake prefix command.
     *
     * Usage:
     * !review fake @user 5
     */
    async fakeReview(message, args) {
        if (!message.guild) return;

        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('You do not have permission to use this command.');
        }

        if (args.length < 2) {
            return message.reply(
                'Usage: `!review fake @user <1-5>`'
            );
        }

        const userMention = args[0];
        const userId = userMention.replace(/[<@!>]/g, '');

        const stars = Number(args[1]);

        if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
            return message.reply('The rating must be between **1 and 5 stars**.');
        }

        let targetUser;

        try {
            targetUser = await message.client.users.fetch(userId);
        } catch {
            return message.reply('I could not find that user.');
        }

        let targetMember;

        try {
            targetMember = await message.guild.members.fetch(userId);
        } catch {
            return message.reply('That user is not in this server.');
        }

        const role = message.guild.roles.cache.get(REVIEW_ROLE_ID);

        if (!role) {
            return message.reply(
                `I could not find the review role \`${REVIEW_ROLE_ID}\`.`
            );
        }

        if (role.position >= message.guild.members.me.roles.highest.position) {
            return message.reply(
                'I cannot give the review role because my highest role is not above it.'
            );
        }

        try {
            await targetMember.roles.add(
                role,
                `Fake review created by ${message.author.tag}`
            );
        } catch (error) {
            console.error('[Review] Failed to add role:', error);

            return message.reply(
                'I could not give that user the review role. Make sure I have **Manage Roles** permission.'
            );
        }

        const embed = createReviewEmbed({
            user: targetUser,
            reviewer: message.author,
            stars,
            fake: true,
        });

        await message.channel.send({
            embeds: [embed],
        });
    },
};
