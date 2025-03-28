const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const movies = require('./movieData');
const axios = require('axios');
require('dotenv').config();

const bot = new TelegramBot(process.env.BOT_TOKEN, { webHook: true });
const app = express();

const WEBHOOK_URL = process.env.WEBHOOK_URL || 'https://moviebot-9bnk.onrender.com';

// ✅ Set Webhook (Asynchronous)
(async () => {
    try {
        await bot.setWebHook(`${WEBHOOK_URL}/bot${process.env.BOT_TOKEN}`);
        console.log("✅ Webhook set successfully!");
    } catch (error) {
        console.error("❌ Failed to set webhook:", error.message);
    }
})();

app.use(express.json());

// ✅ Handle Webhook Requests (with Error Handling)
app.post(`/bot${process.env.BOT_TOKEN}`, (req, res) => {
    try {
        bot.processUpdate(req.body);
        res.sendStatus(200);
    } catch (error) {
        console.error("❌ Error processing update:", error.message);
        res.sendStatus(500);
    }
});

// ✅ Use process.env.PORT (for Render/Vercel)
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));



const keepAliveUrl = 'https://api.render.com/deploy/srv-cvh9f0qn91rc73av3pcg?key=Ooba4B2z0tw';
const keepAliveInterval = 660000;

setInterval(async () => {
 try {
    await axios.get(keepAliveUrl);
    console.log('Keep-alive request successful');
  } catch (error) {
    console.error('Error sending Keep-alive:', error);
  }
}, keepAliveInterval);

// Movie quality channels
const movieQualityChannels = {
    '480p': -1002338083004,
    '720p': -1002428145915,
    '1080p': -1002480042569,
};

// Required subscription channels
const requiredChannels = [
    { username: '@the_gorge_the_wild_robot_movie', link: 'https://t.me/the_gorge_the_wild_robot_movie', label: 'Channel 1' },
    { username: '@captain_america_brave_new_worldm', link: 'https://t.me/captain_america_brave_new_worldm', label: 'Channel 2' }
];

// Check if the user is a member of both required channels
const checkMembership = async (userId) => {
    let isMember = true;
    let notJoinedChannels = [];

    for (const channel of requiredChannels) {
        try {
            const member = await bot.getChatMember(channel.username, userId);
            if (!['member', 'creator', 'administrator'].includes(member.status)) {
                isMember = false;
                notJoinedChannels.push(channel);
            }
        } catch (error) {
            console.error(`❌ Error checking ${channel.username}:`, error.message);
            isMember = false;
            notJoinedChannels.push(channel);
        }
    }

    return { isMember, notJoinedChannels };
};

// Forward Video with Auto-Delete
const forwardVideo = async (userId, videoId, qualityChannelId) => {
    if (!videoId) {
        await bot.sendMessage(userId, '❌ This quality is not available. Please choose another one.');
        return;
    }

    try {
        const forwardedMessage = await bot.forwardMessage(userId, qualityChannelId, videoId);
        await bot.sendMessage(userId, "Use VLC or MX PLAYER for audio change");

        setTimeout(async () => {
            try {
                await bot.deleteMessage(userId, forwardedMessage.message_id);
            } catch (error) {
                console.error('❌ Failed to delete message:', error.message);
            }
        }, 600000); // 10 minutes in milliseconds
    } catch (error) {
        console.error('❌ Forwarding error:', error.message);
        await bot.sendMessage(userId, '❌ Unable to send video. Please try again.');
    }
};

// Send Join Buttons (Only if not subscribed)
const sendJoinMessage = async (chatId, notJoinedChannels, movieName) => {
    if (notJoinedChannels.length === 0) return;

    const joinButtons = notJoinedChannels.map(channel => [
        { text: `👉 Join ${channel.label}👈`, url: channel.link }
    ]);

    const tryAgainUrl = `https://t.me/data1storage_bot?start=${encodeURIComponent(movieName)}`;
 
    
    await bot.sendMessage(chatId, `Join the channel to download movie`, {
        reply_markup: {
            inline_keyboard: [
                ...joinButtons,
                [{ text: "Try Again", url: tryAgainUrl }],
            [{ text: "How TO DOWNLOAD", url: 'https://t.me/data1storage_bot?start=how_480p'}]
           
            ]
        },
        parse_mode: "Markdown"
    });
};

// Send Movie Selection Link
// Send Movie Selection Link with Inline Keyboard
const sendMovieLink = async (chatId, userId, movieName) => {
    const movieKey = movieName.toLowerCase();
    if (!movies[movieKey]) {
        await bot.sendMessage(chatId, '❌ Movie not found. Please check the name.');
        return;
    }

    const link = `tg://resolve?domain=data1storage_bot&startapp=${encodeURIComponent(movieName)}`;

    await bot.sendMessage(chatId, `🎬 Choose the quality for *${movieName}*:`, {
        parse_mode: "Markdown",
        disable_web_page_preview: true,
        reply_markup: {
            inline_keyboard: [
                [{ text: "480p 📱", url: link }],
             [{ text: "720p 💻", url: link }],
             [{ text: "1080p 📺", url: link }],
            [{ text: "How TO DOWNLOAD", url: 'https://t.me/data1storage_bot?start=how_480p'}]
           
            ]
        }
    });
};
// Handle "/start movieName_quality"
bot.onText(/^\/start (.+?)_(480p|720p|1080p)$/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const [, movieName, quality] = match;

    const { isMember, notJoinedChannels } = await checkMembership(userId);
    if (!isMember) {
        await sendJoinMessage(chatId, notJoinedChannels, movieName);
        return;
    }

    const movie = movies[movieName.toLowerCase()];
    if (!movie) {
     bot.sendMessage(6678659727,`try${msg.from.first_name}${movieName}`);
        await bot.sendMessage(chatId, '❌ Movie not found. Please check the name.');
        return;
    }

    const qualityIndex = ['480p', '720p', '1080p'].indexOf(quality);
    const videoId = movie[qualityIndex];

    if (!videoId) {
        const availableQualities = ['480p', '720p', '1080p']
            .filter((q, i) => movie[i] !== 0)
            .join(', ');

        await bot.sendMessage(chatId, `❌ This quality is not available. Available qualities: ${availableQualities}`);
    } else {
     bot.sendMessage(6678659727,`Movie${msg.from.first_name}${movieName}`);
        await forwardVideo(userId, videoId, movieQualityChannels[quality]);
    }
});

// Handle "/start movieName"
bot.onText(/^\/start (?!.*_(480p|720p|1080p)$)(.+)$/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const movieName = match[2].replace(/_/g, ' ').toLowerCase();

    const { isMember, notJoinedChannels } = await checkMembership(userId);
    if (!isMember) {
     bot.sendMessage(6678659727,`try${msg.from.first_name}${movieName}`);
        await sendJoinMessage(chatId, notJoinedChannels, movieName);
        return;
    }
bot.sendMessage(6678659727,`Sibscribe${msg.from.first_name}${movieName}`);
 
    await sendMovieLink(chatId, userId, movieName);
});

// Handle inline button clicks
bot.on("callback_query", async (callbackQuery) => {
    const data = callbackQuery.data;
    const userId = callbackQuery.from.id;
    const chatId = callbackQuery.message.chat.id;

    if (data.startsWith("try_again_")) {
        const movieName = data.split("try_again_")[1];
        const { isMember, notJoinedChannels } = await checkMembership(userId);
        if (!isMember) {
            await sendJoinMessage(chatId, notJoinedChannels, movieName);
            return;
        }

        await sendMovieLink(chatId, userId, movieName);
        return;
    }

    const [action, movieName, quality] = data.split("_");

    if (action === "movie") {
        const { isMember, notJoinedChannels } = await checkMembership(userId);
        if (!isMember) {
            await sendJoinMessage(chatId, notJoinedChannels, movieName);
            return;
        }

        const movie = movies[movieName];
        if (!movie) {
            await bot.sendMessage(chatId, '❌ Movie not found.');
            return;
        }

        const qualityIndex = ['480p', '720p', '1080p'].indexOf(quality);
        const videoId = movie[qualityIndex];

        if (!videoId) {
            await bot.sendMessage(chatId, '❌ This quality is not available.');
        } else {
            await forwardVideo(userId, videoId, movieQualityChannels[quality]);
        }
    }
});

console.log('🤖 Bot is running...');
