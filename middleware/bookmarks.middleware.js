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
      if (!bookmark.trackId) return true;

      const track = bookmark.trackId;
      const receivedStatus = track.history.some(historyItem => historyItem.status.statusText === 'Получено');
      return !(bookmark.isPaid || receivedStatus);
    });

    const bookmarks = filteredBookmarks.slice(skip, skip + limit);

    await Promise.all(
      bookmarks.map(async (bookmark) => {
        if (!bookmark.trackId) {
          const track = await Track.findOne({ track: bookmark.trackNumber });

          if (track) {
            bookmark.trackId = track._id;
            bookmark.currentStatus = track.status;

            if (!track.user || track.user !== user.phone) {
              track.user = user.phone;
              await track.save();
            }

            const populatedTrack = await Track.findById(track._id)
              .populate('history.status', 'statusText');

            // Рассчитываем цену с учетом персонального тарифа
            const calculatedPrice = user.personalRate
              ? (parseFloat(track.weight) * parseFloat(user.personalRate)).toFixed(2)
              : track.price || 'Неизвестно';

            // Обновляем поле price в модели Track, если был применен персональный тариф
            if (user.personalRate) {
              track.price = calculatedPrice;
              await track.save();
            }

            updatedBookmarks.push({
              ...bookmark.toObject(),
              trackDetails: populatedTrack,
              history: populatedTrack.history,
              price: calculatedPrice,
              weight: track.weight || 'Неизвестно',
              place: track.place || '-',
            });
          } else {
            notFoundBookmarks.push({
              trackNumber: bookmark.trackNumber,
              createdAt: bookmark.createdAt,
              description: bookmark.description,
              price: '-',
              weight: '-',
              place: '-',
            });
          }
        } else {
          const track = await Track.findById(bookmark.trackId)
            .populate('history.status', 'statusText');

          if (track) {
            if (!track.user || track.user !== user.phone) {
              track.user = user.phone;
              await track.save();
            }

            bookmark.currentStatus = track.status;

            const calculatedPrice = user.personalRate
              ? (parseFloat(track.weight) * parseFloat(user.personalRate)).toFixed(2)
              : track.price || '-';

            if (user.personalRate) {
              track.price = calculatedPrice;
              await track.save();
            }

            updatedBookmarks.push({
              ...bookmark.toObject(),
              trackDetails: track,
              history: track.history,
              price: calculatedPrice,
              weight: track.weight || '-',
              place: track.place || '-',
            });
          } else {
            notFoundBookmarks.push({
              trackNumber: bookmark.trackNumber,
              createdAt: bookmark.createdAt,
              description: bookmark.description,
              price: 'Неизвестно',
              weight: 'Неизвестно',
              place: '-',
            });
          }
        }
      })
    );

    await user.save();

    const totalFilteredBookmarks = updatedBookmarks.length + notFoundBookmarks.length;
    const totalPages = Math.ceil(totalFilteredBookmarks / limit);

    res.status(200).json({
      updatedBookmarks,
      notFoundBookmarks,
      totalPages,
      totalBookmarks: totalFilteredBookmarks,
    });
  } catch (error) {
    console.error('Ошибка при получении закладок пользователя:', error);
    res.status(500).json({ message: 'Произошла ошибка при получении закладок' });
  }
};

module.exports = { getUserBookmarks };
