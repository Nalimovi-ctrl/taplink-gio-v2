require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const path = require('path');
const fs = require('fs'); // Модуль для работы с файлами

const app = express();
const PORT = process.env.PORT || 3000;
const STATS_FILE = path.join(__dirname, 'stats.json');

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---

// Функция чтения/записи статистики
const saveEvent = (eventData) => {
    let stats = [];
    if (fs.existsSync(STATS_FILE)) {
        try {
            const fileData = fs.readFileSync(STATS_FILE, 'utf8');
            stats = JSON.parse(fileData);
        } catch (e) {
            console.error('Ошибка чтения stats.json', e);
        }
    }
    stats.push(eventData);
    fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2));
};

// --- API МАРШРУТЫ ---

// 1. Принимает событие (Визит или Клик)
app.post('/track', (req, res) => {
    const { type, target } = req.body;
    
    const newEvent = {
        date: new Date().toISOString(),
        ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
        type: type || 'unknown',   // 'visit' или 'click'
        target: target || 'page'   // 'yandex', 'google', 'index'
    };

    saveEvent(newEvent);
    console.log(`[TRACK] ${newEvent.type}: ${newEvent.target}`);
    res.sendStatus(200);
});

// 2. Отдает статистику для админки
app.get('/api/stats', (req, res) => {
    if (fs.existsSync(STATS_FILE)) {
        res.sendFile(STATS_FILE);
    } else {
        res.json([]);
    }
});

// 3. Отправка отзыва в Telegram (Ваш старый код + запись события)
app.post('/send-telegram', async (req, res) => {
    const { fio, date, phone, text, user_id } = req.body;
    
    // Сохраняем факт отправки формы в статистику
    saveEvent({
        date: new Date().toISOString(),
        ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
        type: 'form_submit',
        target: 'manager_feedback'
    });

    const msg = `📩 Новый отзыв!\nФИО: ${fio}\nДата: ${date}\nТелефон: ${phone}\nОтзыв: ${text}`;
    
    try {
        await axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`, {
            chat_id: process.env.TELEGRAM_CHAT_ID,
            text: msg
        });
        res.sendStatus(200);
    } catch (e) {
        console.error('Telegram error:', e.message);
        res.sendStatus(500);
    }
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
