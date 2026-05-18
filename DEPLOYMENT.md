# Развёртывание проекта

## 1. Структура

- `widget/wt_Konstruktor/`: виджет InSales
- `backend/`: внешний сервис для создания реальных товаров

## 2. Локальная подготовка

1. Установить зависимости:
   - `cd backend`
   - `npm.cmd install`
2. Создать `.env` на основе `backend/.env.example`
3. Поднять Postgres и выполнить `backend/sql/001_init.sql`
4. Проверить проект:
   - `npm.cmd run check`
   - `npm.cmd run dev`

## 3. Что нужно в InSales

1. Товар-шаблон дакимакуры
2. Скрытые коллекции половинок
3. Доступы приложения/API с правом:
   - читать товары
   - создавать товары
   - создавать варианты
   - загружать изображения

## 4. Deploy на Render

1. Создать GitHub-репозиторий и загрузить проект
2. Создать `Render Postgres`
3. Создать `Web Service` из папки `backend`
4. Build command:
   - `npm install && npm run build`
5. Start command:
   - `npm run start`
6. Добавить env vars:
   - `PORT`
   - `NODE_ENV=production`
   - `APP_BASE_URL`
   - `DATABASE_URL`
   - `INSALES_SHOP_URL`
   - `INSALES_ACCESS_TOKEN`
   - при необходимости `INSALES_API_KEY`
   - при необходимости `INSALES_API_PASSWORD`
7. Указать health check path:
   - `/health`
8. В виджете InSales указать `URL backend сервиса`:
   - например `https://daki-constructor.onrender.com`

## 5. Фронтенд-поток

1. Виджет собирает конфигурацию пользователя
2. Вместо прямого add-to-cart вызывает:
   - `POST /api/constructor/build`
3. Получает `buildId`
4. Опрашивает:
   - `GET /api/constructor/build/:id`
5. Когда статус `ready`, берет `variantId`
6. Добавляет в корзину уже реальный созданный variant

## 6. Ближайшие доработки

1. Подключить реальный InSales auth-формат под ваш магазин
2. Привести `pickTemplateVariant()` к вашей конкретной модели option names
3. Переписать виджет на вызов backend вместо прямой отправки формы
4. Добавить очистку старых generated products
5. Добавить worker, если сборка preview станет тяжелой
