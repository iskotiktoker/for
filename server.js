const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');
const helmet = require('helmet');  // <- Бул жаңы кошулду

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-here';

// Helmet коопсуздугу
app.use(helmet());  // <- Бул жаңы кошулду

// Rate limiting (брутфорс коргоо)
let requestCounts = {};
setInterval(() => {
    requestCounts = {};
}, 60000);

app.use((req, res, next) => {
    const ip = req.ip;
    requestCounts[ip] = (requestCounts[ip] || 0) + 1;
    
    if (requestCounts[ip] > 100) { // минутасына 100 запрос
        return res.status(429).json({ error: 'Too many requests' });
    }
    next();
});  // <- Бул жаңы кошулду

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('.'));

// Калган код ошол эле...
// Файлын ичиндеги башка бардык коддор ушул жерден кийин орун алат


// Файлы для хранения данных
const USERS_FILE = './data/users.json';
const TRANSACTIONS_FILE = './data/transactions.json';
const VISITORS_FILE = './data/visitors.json';

// Инициализация файлов данных
function initDataFiles() {
    if (!fs.existsSync('./data')) {
        fs.mkdirSync('./data');
    }
    
    if (!fs.existsSync(USERS_FILE)) {
        fs.writeFileSync(USERS_FILE, JSON.stringify([]));
    }
    
    if (!fs.existsSync(TRANSACTIONS_FILE)) {
        fs.writeFileSync(TRANSACTIONS_FILE, JSON.stringify({}));
    }
    
    if (!fs.existsSync(VISITORS_FILE)) {
        fs.writeFileSync(VISITORS_FILE, JSON.stringify([]));
    }
}

// Чтение/запись данных
function readUsers() {
    return JSON.parse(fs.readFileSync(USERS_FILE));
}

function writeUsers(users) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function readTransactions() {
    return JSON.parse(fs.readFileSync(TRANSACTIONS_FILE));
}

function writeTransactions(transactions) {
    fs.writeFileSync(TRANSACTIONS_FILE, JSON.stringify(transactions, null, 2));
}

function readVisitors() {
    return JSON.parse(fs.readFileSync(VISITORS_FILE));
}

function writeVisitors(visitors) {
    fs.writeFileSync(VISITORS_FILE, JSON.stringify(visitors, null, 2));
}

// Middleware для проверки JWT токена
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Токен отсутствует' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Неверный токен' });
        }
        req.user = user;
        next();
    });
}

// Регистрация посещения
function logVisit(req, user = null) {
    const visitors = readVisitors();
    visitors.push({
        timestamp: new Date().toISOString(),
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent'),
        userId: user ? user.id : null,
        username: user ? user.username : 'Гость',
        endpoint: req.path
    });
    writeVisitors(visitors);
}

// Маршруты

// Главная страница
app.get('/', (req, res) => {
    logVisit(req);
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Страница входа
app.get('/login', (req, res) => {
    logVisit(req);
    res.sendFile(path.join(__dirname, 'login.html'));
});

// Страница регистрации
app.get('/register', (req, res) => {
    logVisit(req);
    res.sendFile(path.join(__dirname, 'register.html'));
});

// Админ-панель
app.get('/admin', authenticateToken, (req, res) => {
    const users = readUsers();
    const user = users.find(u => u.id === req.user.id);
    
    if (!user || !user.isAdmin) {
        return res.status(403).json({ error: 'Доступ запрещен' });
    }
    
    logVisit(req, user);
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// Регистрация пользователя
app.post('/register', async (req, res) => {
    try {
        const { username, password, email } = req.body;
        const users = readUsers();

        // Проверка существования пользователя
        if (users.find(u => u.username === username)) {
            return res.status(400).json({ error: 'Пользователь уже существует' });
        }

        // Хеширование пароля
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Первый пользователь становится администратором
        const isAdmin = users.length === 0;

        const newUser = {
            id: Date.now().toString(),
            username,
            password: hashedPassword,
            email,
            isAdmin,
            createdAt: new Date().toISOString()
        };

        users.push(newUser);
        writeUsers(users);

        logVisit(req, newUser);

        res.status(201).json({ 
            message: 'Пользователь создан', 
            user: { 
                id: newUser.id, 
                username: newUser.username, 
                isAdmin: newUser.isAdmin 
            } 
        });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Вход пользователя
app.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const users = readUsers();

        const user = users.find(u => u.username === username);
        if (!user) {
            return res.status(400).json({ error: 'Неверные учетные данные' });
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(400).json({ error: 'Неверные учетные данные' });
        }

        const token = jwt.sign(
            { id: user.id, username: user.username, isAdmin: user.isAdmin },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        logVisit(req, user);

        res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                isAdmin: user.isAdmin
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Получение транзакций пользователя
app.get('/transactions', authenticateToken, (req, res) => {
    const transactionsData = readTransactions();
    const userTransactions = transactionsData[req.user.id] || [];
    res.json(userTransactions);
});

// Сохранение транзакций пользователя
app.post('/transactions', authenticateToken, (req, res) => {
    const transactions = req.body;
    const transactionsData = readTransactions();
    
    transactionsData[req.user.id] = transactions;
    writeTransactions(transactionsData);
    
    res.json({ message: 'Данные сохранены' });
});

// Админские маршруты

// Получение всех пользователей
app.get('/admin/users', authenticateToken, (req, res) => {
    const users = readUsers();
    const currentUser = users.find(u => u.id === req.user.id);
    
    if (!currentUser || !currentUser.isAdmin) {
        return res.status(403).json({ error: 'Доступ запрещен' });
    }

    const usersWithoutPasswords = users.map(user => ({
        id: user.id,
        username: user.username,
        email: user.email,
        isAdmin: user.isAdmin,
        createdAt: user.createdAt
    }));

    res.json(usersWithoutPasswords);
});

// Получение истории посещений
app.get('/admin/visitors', authenticateToken, (req, res) => {
    const users = readUsers();
    const currentUser = users.find(u => u.id === req.user.id);
    
    if (!currentUser || !currentUser.isAdmin) {
        return res.status(403).json({ error: 'Доступ запрещен' });
    }

    const visitors = readVisitors();
    res.json(visitors);
});

// Получение всех транзакций
app.get('/admin/all-transactions', authenticateToken, (req, res) => {
    const users = readUsers();
    const currentUser = users.find(u => u.id === req.user.id);
    
    if (!currentUser || !currentUser.isAdmin) {
        return res.status(403).json({ error: 'Доступ запрещен' });
    }

    const transactionsData = readTransactions();
    res.json(transactionsData);
});

// Инициализация и запуск сервера
initDataFiles();
app.listen(PORT, () => {
    console.log(`Сервер запущен на http://localhost:${PORT}`);
    console.log('Первый зарегистрированный пользователь станет администратором');
});