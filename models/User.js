const mongoose = require('mongoose');  // Импортируем mongoose

const { Schema, model } = mongoose; // Деструктурируем Schema и model из mongoose

// Схема для закладок треков
const TrackBookmarkSchema = new Schema({
    createdAt: { type: Date, default: Date.now },
    description: { type: String, required: true },
    trackNumber: { type: String, required: true },
    trackId: { type: Schema.Types.ObjectId, ref: 'Track', required: false },
    currentStatus: { type: Schema.Types.ObjectId, ref: 'Status', default: null },
    isPaid: { type: Boolean, default: false } // Новое поле для статуса оплаты
});

// Схема для архива закладок
const ArchiveBookmarkSchema = new Schema({
    createdAt: { type: Date, default: Date.now },
    description: { type: String, required: true },
    trackNumber: { type: String, required: true },
    price: { type: String, required: false},
    weight: { type: String, required: false},
    history: {
        type: [{
            status: { type: Schema.Types.ObjectId, ref: 'Status' },
            date: { type: Date, default: Date.now }
        }],
        default: []
    }
});


// Схема для счетов
const InvoiceSchema = new Schema({
    totalAmount: { type: Number, required: true, default: 0 }, // Общая сумма счета
    totalWeight: { type: Number, required: true, default: 0 }, // Общий вес товаров
    totalItems: { type: Number, required: true, default: 0 }, // Количество товаров в счете
    status: { type: String, enum: ['pending', 'paid'], default: 'pending' }, // Статус счета
    bookmarks: [{ type: TrackBookmarkSchema }], // Список закладок в счете
    createdAt: { type: Date, default: Date.now }, // Дата создания счета
    updatedAt: { type: Date, default: Date.now }  // Дата последнего обновления счета
});

// Основная схема пользователя
const UserSchema = new Schema({
    phone: { type: Number, required: true, unique: true },
    password: { type: String, required: true },
    name: { type: String, required: true },
    surname: { type: String, required: true },
    email: { type: String, required: false },
    role: { type: String, default: "client" },
    createdAt: { type: Date, default: Date.now },
    bookmarks: [TrackBookmarkSchema],  // Закладки треков
    archive: [ArchiveBookmarkSchema],  // Архив закладок
    invoices: [InvoiceSchema],  // Добавляем массив для счетов
    profilePhoto: { type: String, required: false },
    selectedFilial: { type: String, required: false },  // Филиал
    referrer: { type: Schema.Types.ObjectId, ref: 'User', required: false }, // Кто пригласил
    bonuses: { type: Number, required: false },  // Накопленные бонусы
    referralBonusPercentage: { type: Number, default: null },  // %
    personalId: {type: Number, default: null},
    personalRate: { type: String, required: false } // Новое поле для личного тарифа пользователя
});

module.exports = model('User', UserSchema);
