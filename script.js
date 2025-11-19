// Основные переменные
let transactions = [];
let currentFilter = 'all';
let currentSort = 'newest';
let currentDate = new Date();

// Товары
const products = {
    cherry: 'Вишня',
    strawberry: 'Клубника',
    raspberry: 'Малина',
    blueberry: 'Черника',
    apple: 'Яблоки',
    pear: 'Груши',
    plum: 'Сливы',
    other: 'Другой товар'
};

// Единицы измерения
const units = {
    kg: 'кг',
    g: 'г',
    pcs: 'шт',
    box: 'ящ',
    crate: 'кор'
};

// Функции для работы с API
async function apiRequest(url, options = {}) {
    const token = localStorage.getItem('token');
    
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': token ? `Bearer ${token}` : ''
        }
    };
    
    const finalOptions = { ...defaultOptions, ...options };
    
    try {
        const response = await fetch(url, finalOptions);
        
        if (response.status === 401) {
            // Токен невалиден, перенаправляем на страницу входа
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = 'login.html';
            return;
        }
        
        return await response.json();
    } catch (error) {
        console.error('API error:', error);
        throw error;
    }
}

// Загрузка транзакций с сервера
async function loadTransactionsFromServer() {
    try {
        const data = await apiRequest('/transactions');
        return data || [];
    } catch (error) {
        console.error('Error loading transactions:', error);
        return [];
    }
}

// Сохранение транзакций на сервер
async function saveTransactionsToServer(transactions) {
    try {
        await apiRequest('/transactions', {
            method: 'POST',
            body: JSON.stringify(transactions)
        });
    } catch (error) {
        console.error('Error saving transactions:', error);
    }
}

// Инициализация приложения
document.addEventListener('DOMContentLoaded', async function() {
    // Проверка авторизации на главной странице
    if (window.location.pathname.endsWith('index.html') || window.location.pathname === '/') {
        const token = localStorage.getItem('token');
        if (!token) {
            window.location.href = 'login.html';
            return;
        }
    }

    // Загрузка транзакций
    await loadTransactions();
    
    // Инициализация интерфейса
    setDefaultDate();
    renderTransactions();
    updateStats();
    renderInventory();
    renderCalendar();
    setupTabs();
    
    // Обработчики событий
    setupEventListeners();
});

// Установка текущей даты по умолчанию
function setDefaultDate() {
    const today = new Date().toISOString().split('T')[0];
    const dateInput = document.getElementById('transaction-date');
    if (dateInput) {
        dateInput.value = today;
    }
}

// Настройка вкладок
function setupTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const tabId = this.dataset.tab;
            
            // Активация кнопки вкладки
            tabBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            // Активация контента вкладки
            tabContents.forEach(content => content.classList.remove('active'));
            document.getElementById(`${tabId}-tab`).classList.add('active');
        });
    });
}

// Настройка обработчиков событий
function setupEventListeners() {
    const transactionForm = document.getElementById('add-transaction-form');
    const filterBtns = document.querySelectorAll('.filter-btn');
    const sortSelect = document.getElementById('sort-transactions');
    
    if (transactionForm) {
        transactionForm.addEventListener('submit', handleTransactionSubmit);
    }
    
    if (filterBtns.length > 0) {
        filterBtns.forEach(btn => {
            btn.addEventListener('click', function() {
                filterBtns.forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                currentFilter = this.dataset.filter;
                renderTransactions();
            });
        });
    }
    
    if (sortSelect) {
        sortSelect.addEventListener('change', function() {
            currentSort = this.value;
            renderTransactions();
        });
    }
}

// Обработчик отправки формы транзакции
async function handleTransactionSubmit(e) {
    e.preventDefault();
    
    const type = document.querySelector('input[name="type"]:checked').value;
    const product = document.getElementById('transaction-product').value;
    const amount = parseFloat(document.getElementById('transaction-amount').value);
    const unit = document.getElementById('transaction-unit').value;
    const price = parseFloat(document.getElementById('transaction-price').value);
    const date = document.getElementById('transaction-date').value;
    
    const total = amount * price;
    
    const newTransaction = {
        id: Date.now(),
        type,
        product,
        amount,
        unit,
        price,
        total,
        date: date || new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString()
    };
    
    transactions.push(newTransaction);
    await saveTransactions();
    renderTransactions();
    updateStats();
    renderInventory();
    renderCalendar();
    showNotification('Операция успешно добавлена!', 'success');
    
    // Сброс формы
    e.target.reset();
    setDefaultDate();
    document.querySelector('input[name="type"][value="purchase"]').checked = true;
}

// Функция отрисовки транзакций
function renderTransactions() {
    const transactionList = document.getElementById('transaction-list');
    if (!transactionList) return;
    
    // Очистка списка
    transactionList.innerHTML = '';
    
    // Фильтрация транзакций
    let filteredTransactions = transactions.filter(transaction => {
        if (currentFilter === 'all') return true;
        if (currentFilter === 'purchase') return transaction.type === 'purchase';
        if (currentFilter === 'sale') return transaction.type === 'sale';
        return transaction.product === currentFilter;
    });
    
    // Сортировка транзакций
    filteredTransactions.sort((a, b) => {
        if (currentSort === 'newest') {
            return new Date(b.createdAt) - new Date(a.createdAt);
        } else if (currentSort === 'oldest') {
            return new Date(a.createdAt) - new Date(b.createdAt);
        } else if (currentSort === 'amount') {
            return b.amount - a.amount;
        } else if (currentSort === 'price') {
            return b.price - a.price;
        }
        return 0;
    });
    
    // Если транзакций нет
    if (filteredTransactions.length === 0) {
        const emptyState = document.createElement('div');
        emptyState.className = 'empty-state';
        emptyState.innerHTML = `
            <i class="fas fa-receipt"></i>
            <h3>Операции не найдены</h3>
            <p>${currentFilter === 'purchase' ? 'У вас нет закупок' : 
                currentFilter === 'sale' ? 'У вас нет продаж' : 
                'Добавьте свою первую операцию!'}</p>
        `;
        transactionList.appendChild(emptyState);
        return;
    }
    
    // Отрисовка транзакций
    filteredTransactions.forEach(transaction => {
        const transactionItem = document.createElement('div');
        transactionItem.className = `transaction-item ${transaction.type}`;
        
        const typeText = transaction.type === 'purchase' ? 'Закупка' : 'Продажа';
        const sign = transaction.type === 'purchase' ? '-' : '+';
        
        transactionItem.innerHTML = `
            <div class="transaction-info">
                <div class="transaction-title">${typeText}: ${products[transaction.product]}</div>
                <div class="transaction-meta">
                    <span class="category-badge">${formatDate(transaction.date)}</span>
                    <span class="unit-badge">${transaction.amount} ${units[transaction.unit]}</span>
                    <span>Цена: ${transaction.price} ₽/${units[transaction.unit]}</span>
                </div>
            </div>
            <div class="transaction-amount ${transaction.type}">
                ${sign}${transaction.total.toFixed(2)} ₽
            </div>
            <div class="transaction-actions">
                <button class="action-btn delete-transaction" data-id="${transaction.id}">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        
        transactionList.appendChild(transactionItem);
    });
    
    // Добавление обработчиков событий для кнопок удаления
    document.querySelectorAll('.delete-transaction').forEach(btn => {
        btn.addEventListener('click', function() {
            const transactionId = parseInt(this.dataset.id);
            deleteTransaction(transactionId);
        });
    });
}

// Функция отрисовки склада
function renderInventory() {
    const inventorySummary = document.getElementById('inventory-summary');
    const inventoryTransactionList = document.getElementById('inventory-transaction-list');
    
    if (!inventorySummary || !inventoryTransactionList) return;
    
    // Очистка списков
    inventorySummary.innerHTML = '';
    inventoryTransactionList.innerHTML = '';
    
    // Расчет остатков по товарам
    const inventory = {};
    
    transactions.forEach(transaction => {
        if (!inventory[transaction.product]) {
            inventory[transaction.product] = {
                amount: 0,
                unit: transaction.unit,
                purchaseTotal: 0,
                saleTotal: 0
            };
        }
        
        if (transaction.type === 'purchase') {
            inventory[transaction.product].amount += transaction.amount;
            inventory[transaction.product].purchaseTotal += transaction.total;
        } else {
            inventory[transaction.product].amount -= transaction.amount;
            inventory[transaction.product].saleTotal += transaction.total;
        }
    });
    
    // Отрисовка сводки по складу
    Object.entries(inventory).forEach(([product, data]) => {
        if (data.amount > 0) {
            const inventoryItem = document.createElement('div');
            inventoryItem.className = 'inventory-item';
            inventoryItem.innerHTML = `
                <h4>${products[product]}</h4>
                <div class="inventory-amount">${data.amount.toFixed(2)}</div>
                <div class="inventory-unit">${units[data.unit]}</div>
            `;
            inventorySummary.appendChild(inventoryItem);
        }
    });
    
    // Если запасов нет
    if (inventorySummary.children.length === 0) {
        inventorySummary.innerHTML = `
            <div class="empty-state" style="width: 100%;">
                <i class="fas fa-box-open"></i>
                <p>Нет товаров на складе</p>
            </div>
        `;
    }
    
    // Отрисовка операций для вкладки склада
    const inventoryTransactions = transactions
        .filter(t => t.type === 'purchase')
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 10);
    
    if (inventoryTransactions.length === 0) {
        const emptyState = document.createElement('div');
        emptyState.className = 'empty-state';
        emptyState.innerHTML = `
            <i class="fas fa-receipt"></i>
            <h3>Операции не найдены</h3>
            <p>Добавьте первую закупку!</p>
        `;
        inventoryTransactionList.appendChild(emptyState);
        return;
    }
    
    inventoryTransactions.forEach(transaction => {
        const transactionItem = document.createElement('div');
        transactionItem.className = `transaction-item ${transaction.type}`;
        
        transactionItem.innerHTML = `
            <div class="transaction-info">
                <div class="transaction-title">Закупка: ${products[transaction.product]}</div>
                <div class="transaction-meta">
                    <span class="category-badge">${formatDate(transaction.date)}</span>
                    <span class="unit-badge">${transaction.amount} ${units[transaction.unit]}</span>
                    <span>Цена: ${transaction.price} ₽/${units[transaction.unit]}</span>
                </div>
            </div>
            <div class="transaction-amount ${transaction.type}">
                -${transaction.total.toFixed(2)} ₽
            </div>
        `;
        
        inventoryTransactionList.appendChild(transactionItem);
    });
}

// Функция отрисовки календаря
function renderCalendar() {
    const calendar = document.getElementById('calendar');
    if (!calendar) return;
    
    // Очистка календаря
    calendar.innerHTML = '';
    
    // Заголовки дней недели
    const daysOfWeek = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    daysOfWeek.forEach(day => {
        const dayElement = document.createElement('div');
        dayElement.className = 'calendar-day header';
        dayElement.textContent = day;
        calendar.appendChild(dayElement);
    });
    
    // Получение первого дня месяца и количество дней
    const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    const daysInMonth = lastDay.getDate();
    
    // Пустые ячейки до первого дня месяца
    const firstDayOfWeek = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
    for (let i = 0; i < firstDayOfWeek; i++) {
        const emptyDay = document.createElement('div');
        emptyDay.className = 'calendar-day';
        calendar.appendChild(emptyDay);
    }
    
    // Ячейки с днями месяца
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    for (let day = 1; day <= daysInMonth; day++) {
        const dayElement = document.createElement('div');
        const currentDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
        
        dayElement.className = 'calendar-day';
        
        // Проверка, является ли день сегодняшним
        if (currentDay.getTime() === today.getTime()) {
            dayElement.classList.add('today');
        }
        
        // Добавление номера дня
        const dayNumber = document.createElement('div');
        dayNumber.className = 'day-number';
        dayNumber.textContent = day;
        dayElement.appendChild(dayNumber);
        
        // Проверка операций в этот день
        const dayTransactions = transactions.filter(transaction => {
            const transactionDate = new Date(transaction.date);
            return transactionDate.getDate() === day && 
                   transactionDate.getMonth() === currentDate.getMonth() && 
                   transactionDate.getFullYear() === currentDate.getFullYear();
        });
        
        if (dayTransactions.length > 0) {
            dayElement.classList.add('has-transactions');
            
            const transactionsContainer = document.createElement('div');
            transactionsContainer.className = 'day-transactions';
            
            // Группировка операций по типу
            const purchaseCount = dayTransactions.filter(t => t.type === 'purchase').length;
            const saleCount = dayTransactions.filter(t => t.type === 'sale').length;
            
            if (purchaseCount > 0) {
                const purchaseIndicator = document.createElement('div');
                purchaseIndicator.className = 'transaction-indicator purchase';
                purchaseIndicator.textContent = `Закупок: ${purchaseCount}`;
                transactionsContainer.appendChild(purchaseIndicator);
            }
            
            if (saleCount > 0) {
                const saleIndicator = document.createElement('div');
                saleIndicator.className = 'transaction-indicator sale';
                saleIndicator.textContent = `Продаж: ${saleCount}`;
                transactionsContainer.appendChild(saleIndicator);
            }
            
            dayElement.appendChild(transactionsContainer);
        }
        
        calendar.appendChild(dayElement);
    }
}

// Функция удаления транзакции
async function deleteTransaction(transactionId) {
    transactions = transactions.filter(transaction => transaction.id !== transactionId);
    await saveTransactions();
    renderTransactions();
    updateStats();
    renderInventory();
    renderCalendar();
    showNotification('Операция удалена!', 'error');
}

// Функция сохранения транзакций
async function saveTransactions() {
    await saveTransactionsToServer(transactions);
}

// Функция загрузки транзакций
async function loadTransactions() {
    const serverTransactions = await loadTransactionsFromServer();
    if (serverTransactions.length > 0) {
        transactions = serverTransactions;
    }
}

// Функция обновления статистики
function updateStats() {
    const totalPurchaseEl = document.getElementById('total-purchase');
    const totalSaleEl = document.getElementById('total-sale');
    const totalProfitEl = document.getElementById('total-profit');
    
    if (!totalPurchaseEl || !totalSaleEl || !totalProfitEl) return;
    
    const purchase = transactions
        .filter(t => t.type === 'purchase')
        .reduce((sum, t) => sum + t.total, 0);
        
    const sale = transactions
        .filter(t => t.type === 'sale')
        .reduce((sum, t) => sum + t.total, 0);
        
    const profit = sale - purchase;
    
    totalPurchaseEl.textContent = `${purchase.toFixed(2)} ₽`;
    totalSaleEl.textContent = `${sale.toFixed(2)} ₽`;
    totalProfitEl.textContent = `${profit.toFixed(2)} ₽`;
}

// Вспомогательные функции
function formatDate(dateString) {
    const options = { day: '2-digit', month: '2-digit', year: 'numeric' };
    return new Date(dateString).toLocaleDateString('ru-RU', options);
}

function showNotification(message, type = 'success') {
    const notification = document.getElementById('notification');
    if (!notification) return;
    
    const notificationContent = notification.querySelector('.notification-content');
    notificationContent.innerHTML = `
        <h4>${type === 'success' ? 'Успешно!' : 'Ошибка!'}</h4>
        <p>${message}</p>
    `;
    
    notification.className = `notification ${type} show`;
    
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

// Глобальные функции для навигации по календарю
window.prevMonth = function() {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendar();
};

window.nextMonth = function() {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendar();
};