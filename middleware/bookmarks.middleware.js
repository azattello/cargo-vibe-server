const Track = require('../models/Track'); // Подключаем модель Track
const User = require('../models/User');   // Подключаем модель User

// Функция для получения закладок пользователя с учетом пагинации
const getUserBookmarks = async (req, res) => {
  try {
    const userId = req.params.userId; // Получаем ID пользователя
    const page = parseInt(req.query.page) || 1; // Получаем номер страницы, по умолчанию 1
    const limit = 20; // Количество закладок на одной странице
    const skip = (page - 1) * limit; // Вычисляем количество документов для пропуска

    // Находим пользователя по ID и заполняем закладки
    const user = await User.findById(userId).populate('bookmarks.trackId');

    // Если пользователь не найден
    if (!user) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }

    const updatedBookmarks = [];
    const notFoundBookmarks = [];

    // Фильтруем закладки, исключая "Полученные" и "Оплаченные"
    const filteredBookmarks = user.bookmarks.filter((bookmark) => {
      // Если у закладки нет trackId, она не будет считаться полученной и оплаченной
      if (!bookmark.trackId) return true;

      const track = bookmark.trackId;

      // Проверяем, если закладка имеет статус "Получено" и флаг оплаты
      const receivedStatus = track.history.some(historyItem => historyItem.status.statusText === 'Получено');
      return !(bookmark.isPaid || receivedStatus); // Исключаем закладки, которые оплачены или "Получены"
    });

    const bookmarks = filteredBookmarks.slice(skip, skip + limit); // Пагинация для отфильтрованных закладок

    await Promise.all(
      bookmarks.map(async (bookmark) => {
        if (!bookmark.trackId) {
          // Если trackId отсутствует, ищем трек по trackNumber
          const track = await Track.findOne({ track: bookmark.trackNumber });

          if (track) {
            // Если трек найден, обновляем bookmark с trackId
            bookmark.trackId = track._id;
            await user.save(); // Сохраняем обновленный trackId в закладке

            // Проверка, есть ли уже запись с таким пользователем
            if (!track.user || track.user !== user.phone) {
              track.user = user.phone;
              await track.save();
            }

            // Подтягиваем историю статусов и статус текст
            const populatedTrack = await Track.findById(track._id)
              .populate('history.status', 'statusText'); // Подтягиваем статус с текстом

            updatedBookmarks.push({
              ...bookmark.toObject(),
              trackDetails: populatedTrack, // Добавляем информацию о треке
              history: populatedTrack.history, // Добавляем историю статусов с текстом
              price: user.personalRate ? (parseFloat(track.weight) * parseFloat(user.personalRate)).toFixed(2) : track.price || 'Неизвестно', // Рассчитываем сумму с учетом персонального тарифа, если он есть
              weight: track.weight || 'Неизвестно', // Добавляем вес
              place: track.place || '-' // Добавляем место
            });
          } else {
            // Если трек не найден, добавляем его в notFoundBookmarks
            notFoundBookmarks.push({
              trackNumber: bookmark.trackNumber,
              createdAt: bookmark.createdAt,
              description: bookmark.description,
              price: '-',
              weight: '-',
              place: '-'
            });
          }
        } else {
          // Если trackId уже есть, подтягиваем все данные трека
          const track = await Track.findById(bookmark.trackId)
            .populate('history.status', 'statusText'); // Подтягиваем статус с текстом

          if (track) {
            // Проверка, есть ли уже запись с таким пользователем
            if (!track.user || track.user !== user.phone) {
              track.user = user.phone;
              await track.save();
            }

            updatedBookmarks.push({
              ...bookmark.toObject(),
              trackDetails: track, // Информация о треке
              history: track.history, // Добавляем историю статусов с текстом
              price: user.personalRate ? (parseFloat(track.weight) * parseFloat(user.personalRate)).toFixed(2) : track.price || '-', // Рассчитываем сумму с учетом персонального тарифа, если он есть
              weight: track.weight || '-', // Добавляем вес
              place: track.place || '-' // Добавляем место
            });
          } else {
            // Если track не найден в базе данных
            notFoundBookmarks.push({
              trackNumber: bookmark.trackNumber,
              createdAt: bookmark.createdAt,
              description: bookmark.description,
              price: 'Неизвестно',
              weight: 'Неизвестно',
              place: '-'
            });
          }
        }
      })
    );

    const totalFilteredBookmarks = updatedBookmarks.length + notFoundBookmarks.length ; // Подсчитываем только те закладки, которые не были "Получены" и оплачены
    const totalPages = Math.ceil(totalFilteredBookmarks / limit);

    res.status(200).json({
      updatedBookmarks,
      notFoundBookmarks,
      totalPages,
      totalBookmarks: totalFilteredBookmarks // Возвращаем только количество тех закладок, которые не получены и не оплачены
    });
  } catch (error) {
    console.error('Ошибка при получении закладок пользователя:', error);
    res.status(500).json({ message: 'Произошла ошибка при получении закладок' });
  }
};

module.exports = { getUserBookmarks };
