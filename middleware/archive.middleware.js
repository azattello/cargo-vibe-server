const Track = require('../models/Track'); // Подключаем модель Track
const User = require('../models/User');   // Подключаем модель User

// Функция для получения архива закладок пользователя
const getUserArchive = async (req, res) => {
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

    // Фильтруем закладки, возвращая только оплаченные или полученные, исключая без trackId
    const filteredBookmarks = user.bookmarks.filter((bookmark) => {
      // Пропускаем закладки, если нет trackId
      if (!bookmark.trackId) return false;

      const track = bookmark.trackId;

      // Проверяем, если закладка оплачена или имеет статус "Получено"
      const receivedStatus = track.history.some(historyItem => historyItem.status.statusText === 'Получено');
      return bookmark.isPaid || receivedStatus; // Возвращаем закладки, которые оплачены или имеют статус "Получено"
    });

    const bookmarks = filteredBookmarks.slice(skip, skip + limit); // Пагинация для отфильтрованных закладок

    await Promise.all(
      bookmarks.map(async (bookmark) => {
        const track = bookmark.trackId;

        // Проверка, есть ли уже запись с таким пользователем в модели трека
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
      })
    );

    const totalFilteredBookmarks = updatedBookmarks.length; // Подсчитываем только те закладки, которые оплачены или получены
    const totalPages = Math.ceil(totalFilteredBookmarks / limit);

    res.status(200).json({
      updatedBookmarks,
      totalPages,
      totalBookmarks: totalFilteredBookmarks // Возвращаем только количество закладок, которые оплачены или получены
    });
  } catch (error) {
    console.error('Ошибка при получении архива закладок пользователя:', error);
    res.status(500).json({ message: 'Произошла ошибка при получении архива закладок' });
  }
};

module.exports = { getUserArchive };
