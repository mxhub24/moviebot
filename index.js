
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const movie = require('./movieData'); // Import anime data from animeData.js
const fs = require('fs');
const path = require('path');

// Initialize Telegram Bot
const bot = new TelegramBot("8116206839:AAFDnGJWFYmyjVIJH0FiKCmlGEDUVB11Wac", { polling: true });
const app = express();

app.listen(4000, () => {
    console.log('Server listening on port 4000');
});

// ✅ Your actual channel where users must be subscribed
const channelUsername = '@the_gorge_the_wild_robot_movie';

// ✅ Forward video function with auto-delete after 15 minutes
// ✅ Forward video function with error handling for missing episodes
const forwardVideos = async (userId, episodeNumbers, qualityChannelId, episodeRange, quality) => {
    try {
        await bot.sendMessage(userId, `📺 Forwarding Episodes ${episodeRange} in ${quality}...`);

        const forwardedMessages = [];
        const failedEpisodes = [];

        // Forward each episode separately and track failures
        for (let episode of episodeNumbers) {
            try {
                const msg = await bot.forwardMessage(userId, qualityChannelId, episode);
                forwardedMessages.push(msg);
            } catch (error) {
                console.error(`Error forwarding episode ${episode} (${quality}):`, error.message);
                failedEpisodes.push(episode); // Track failed episodes
            }
        }

        // Notify user if some episodes couldn't be forwarded
        if (failedEpisodes.length > 0) {
            await bot.sendMessage(userId, `❌ Unable to send the following episodes in ${quality}: ${failedEpisodes.join(', ')}.`);
        }

        // Delete forwarded messages after 15 minutes
        setTimeout(async () => {
            try {
                await Promise.all(
                    forwardedMessages.map(msg => bot.deleteMessage(userId, msg.message_id))
                );
            } catch (error) {
                console.error('❌ Failed to delete messages:', error.message);
            }
        }, 900000); // 15 minutes

        await bot.sendMessage(userId, "🎥 Videos forwarded successfully!");
    } catch (error) {
        console.error('Forwarding error:', error);
        await bot.sendMessage(userId, '❌ Unable to send videos. Please try again.');
    }
};


// ✅ Check if user is subscribed
const checkMembership = async (userId) => {
    try {
        const member = await bot.getChatMember(channelUsername, userId);
        return ['member', 'creator', 'administrator'].includes(member.status);
    } catch (error) {
        console.error("Membership check error:", error);
        return false;
    }
};

// ✅ Ask user to join channel with "Try Again" button
const sendJoinMessage = async (chatId, lastCommand) => {
    const options = {
        reply_markup: {
            inline_keyboard: [
                [{ text: '👉 Join Channel 👈', url: 'https://t.me/the_gorge_the_wild_robot_movie' }],
                [{ text: '🔄 Try Again', callback_data: `retry_${lastCommand}` }],
            ],
        },
    };
    await bot.sendMessage(chatId, '👇 Join the channel to get the content 👇', options);
};

// ✅ Anime quality channels
const animeQualityChannels = {
    '480p': -1002338083004,
    '720p': -1002428145915,
    '1080p': -1002480042569,
};

// ✅ Handle anime request from text
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const text = msg.text.toLowerCase();

    // Check if the user is subscribed
    if (!(await checkMembership(userId))) {
        await sendJoinMessage(chatId, text);
        return;
    }

    // Check if the anime exists
    if (text in anime) {
        const allEpisodes = Object.keys(anime[text]).map(Number).sort((a, b) => a - b);
        const episodeGroups = [];

        if (allEpisodes.length > 50) {
            // 🔹 More than 50 episodes: group into sets of 10
            for (let i = 0; i < allEpisodes.length; i += 10) {
                const group = allEpisodes.slice(i, i + 10);
                episodeGroups.push(group);
            }
        } else if (allEpisodes.length > 19 && allEpisodes.length <= 50) {
            // 🔹 Between 20 and 50 episodes: group into sets of 5
            for (let i = 0; i < allEpisodes.length; i += 5) {
                const group = allEpisodes.slice(i, i + 5);
                episodeGroups.push(group);
            }
        } else {
            // 🔹 Less than 20 episodes: send single episode per button
            for (let i = 0; i < allEpisodes.length; i++) {
                episodeGroups.push([allEpisodes[i]]);
            }
        }

        // Create inline keyboard buttons for each episode group
        const episodes = episodeGroups.map(group => {
            if (group.length === 1) {
                return [{ text: `Episode ${group[0]}`, callback_data: `episodes_${text}_${group[0]}_${group[0]}` }];
            } else {
                const episodeRange = `${group[0]}-${group[group.length - 1]}`;
                return [{ text: `Episodes ${episodeRange}`, callback_data: `episodes_${text}_${group[0]}_${group[group.length - 1]}` }];
            }
        });

        // Send the inline keyboard with grouped episodes
        await bot.sendMessage(chatId, `📺 Select episodes for *${text}*`, {
            parse_mode: "Markdown",
            reply_markup: { inline_keyboard: episodes }
        });
    }
});

// Handle episode group selection
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const userId = query.from.id;
    const callbackData = query.data;

    if (callbackData.startsWith('episodes_')) {
        const [, animeName, startEpisode, endEpisode] = callbackData.split('_');
        const start = parseInt(startEpisode);
        const end = parseInt(endEpisode);

        // Generate the link for quality selection
        const link = `https://moviehub24.github.io/anime?userId=${userId}&anime=${animeName}&start=${start}&end=${end}`;
        const message = `🎬 [Click here](https://moviehub24.github.io/anime?userId=${userId}&anime=${animeName}&start=${start}&end=${end}) to select the quality for *${animeName}* Episodes ${start}-${end}.`;

        // Send the message with the link
        await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    }
});
 // Handler for /start command with parameters
bot.onText(/\/start (\w+)_(\d+)_(\d+)_(480p|720p|1080p)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const animeName = match[1].toLowerCase();
    const start = parseInt(match[2]);
    const end = parseInt(match[3]);
    const quality = match[4];

    // Check if the user is subscribed
    if (!(await checkMembership(userId))) {
        await sendJoinMessage(chatId, `/start ${animeName}_${start}_${end}_${quality}`);
        return;
    }

    // Validate the anime name
    if (!(animeName in anime)) {
        await bot.sendMessage(chatId, '❌ Anime not found. Please check the name and try again.');
        return;
    }

    // Validate the episode range
    const allEpisodes = Object.keys(anime[animeName]).map(Number);
    if (!allEpisodes.includes(start) || !allEpisodes.includes(end) || start > end) {
        await bot.sendMessage(chatId, '❌ Invalid episode range. Please check the episode numbers and try again.');
        return;
    }

    // Validate the quality
    if (!(quality in animeQualityChannels)) {
        await bot.sendMessage(chatId, '❌ Invalid quality selected. Please choose from 480p, 720p, or 1080p.');
        return;
    }

    // Retrieve the video IDs for the specified episodes and quality
    const episodeNumbers = [];
    const qualityMapping = {
        '480p': 0,
        '720p': 1,
        '1080p': 2
    };
    for (let episode = start; episode <= end; episode++) {
        const videoIds = anime[animeName][episode];
        const videoId = videoIds[qualityMapping[quality]];
        if (videoId) {
            episodeNumbers.push(videoId);
        } else {
            await bot.sendMessage(chatId, `❌ Episode ${episode} is not available in ${quality}.`);
        }
    }

    // If no valid videos found, inform the user
    if (episodeNumbers.length === 0) {
        await bot.sendMessage(chatId, `❌ No episodes available in ${quality} for the specified range.`);
        return;
    }

    const qualityChannelId = animeQualityChannels[quality];
    const episodeRange = `${start}-${end}`;

    // Inform user and forward the videos
    await bot.sendMessage(chatId, `🎥 Use VLC or MX Player to change audio.`, { parse_mode: "Markdown" });
    await forwardVideos(userId, episodeNumbers, qualityChannelId, episodeRange, quality);
    await bot.sendMessage(chatId, "🕒 These episodes will be deleted after 15 minutes.");
});

