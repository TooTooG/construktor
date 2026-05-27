# Конструктор товара для InSales

Виджет-конструктор для магазина InSales. Пользователь выбирает изображения для лицевой и обратной стороны дакимакуры, выбирает параметры товара, после чего внешний backend создает реальный товар в InSales, загружает сгенерированное preview и возвращает `variant_id` для добавления в корзину.

## Что входит в проект

- `widget/wt_Konstruktor` - виджет InSales 4-го поколения на Liquid, JavaScript и SCSS.
- `backend` - внешний сервис на Node.js, TypeScript, Fastify, PostgreSQL и Sharp.
- `backend/sql/001_init.sql` - SQL-схема таблицы сборок.
- `render.yaml` - Blueprint для деплоя backend и Postgres на Render.
- `DEPLOYMENT.md` - краткая инструкция по развертыванию.

## Архитектура

```text
Покупатель
  -> виджет InSales
  -> POST /api/constructor/build
  -> backend
  -> InSales Admin API
  -> новый скрытый товар + preview
  -> GET /api/constructor/build/:id
  -> виджет добавляет generated variant_id в корзину
```

Backend не хранит изображения локально. Он берет изображения товаров из InSales, склеивает их через `sharp`, создает новый скрытый товар и загружает preview через Admin API.

## Пользовательский сценарий

1. Пользователь открывает страницу конструктора.
2. Виджет загружает товар-шаблон по `template_product_id`.
3. Пользователь выбирает лицевую сторону из `front_collection_handle`.
4. Пользователь выбирает обратную сторону из `back_collection_handle`.
5. Пользователь выбирает вариант товара: размер, материал или другие опции шаблонного товара.
6. Виджет отправляет выбранную конфигурацию на backend.
7. Backend создает generated product в InSales.
8. Виджет получает `variant_id` созданного товара и отправляет его в корзину.

## Backend

Стек:

- Node.js `>=22`
- TypeScript
- Fastify
- PostgreSQL
- Sharp
- Zod

Команды:

```powershell
cd backend
npm.cmd install
npm.cmd run check
npm.cmd run build
npm.cmd run start
```

Для разработки:

```powershell
cd backend
npm.cmd run dev
```

На Windows лучше запускать именно `npm.cmd`, если PowerShell блокирует `npm.ps1` политикой выполнения.

## Переменные окружения backend

Создайте `backend/.env` на основе `backend/.env.example`.

Обязательные переменные:

- `PORT` - порт backend, локально обычно `3001`.
- `NODE_ENV` - `development`, `test` или `production`.
- `APP_BASE_URL` - публичный URL backend после деплоя.
- `DATABASE_URL` - строка подключения PostgreSQL.
- `INSALES_SHOP_URL` - URL магазина InSales, например `https://example.myinsales.ru`.

Авторизация InSales Admin API: используйте один из вариантов.

Вариант 1:

```env
INSALES_API_KEY=...
INSALES_API_PASSWORD=...
```

Вариант 2:

```env
INSALES_ACCESS_TOKEN=...
```

Не оставляйте одновременно заполненными `INSALES_API_KEY`, `INSALES_API_PASSWORD` и `INSALES_ACCESS_TOKEN`, если хотите использовать Bearer token: backend сначала выбирает Basic Auth.

## API

### `GET /health`

Проверка живости сервиса.

Пример ответа:

```json
{
  "status": "ok"
}
```

### `POST /api/constructor/build`

Создает запись сборки и запускает создание generated product.

Пример тела:

```json
{
  "templateProductId": 123456,
  "templateVariantId": 987654,
  "frontProductId": 111111,
  "backProductId": 222222,
  "quantity": 1,
  "selection": {
    "option-1-size": "160x50",
    "option-2-material": "Габардин"
  }
}
```

Пример успешного ответа:

```json
{
  "buildId": "bld_...",
  "status": "ready"
}
```

### `GET /api/constructor/build/:id`

Возвращает статус сборки.

Пример ответа:

```json
{
  "buildId": "bld_...",
  "status": "ready",
  "productId": 123,
  "variantId": 456,
  "productHandle": "generated-product-handle",
  "error": null
}
```

Статусы:

- `pending` - запись создана.
- `building` - backend создает товар и preview.
- `ready` - товар создан, можно добавлять `variantId` в корзину.
- `failed` - сборка не удалась, подробность лежит в `errorText`.

## База данных

Для PostgreSQL выполните:

```powershell
psql "$env:DATABASE_URL" -f backend/sql/001_init.sql
```

Таблица `constructor_builds` хранит:

- id сборки;
- статус сборки;
- id шаблонного товара;
- id выбранных товаров для лицевой и обратной стороны;
- количество;
- JSON выбранных опций;
- id созданного generated product;
- id созданного generated variant;
- permalink созданного товара;
- URL preview;
- текст ошибки.

## Виджет InSales

Папка виджета:

```text
widget/wt_Konstruktor
```

Основные файлы:

- `info.json` - метаданные виджета.
- `settings_form.json` - поля настроек в редакторе InSales.
- `settings_data.json` - значения по умолчанию.
- `snippet.liquid` - HTML/Liquid-разметка.
- `snippet.js` - логика выбора изображений, вариантов и отправки сборки.
- `snippet.scss` - стили карточки и модального окна.

Настройки виджета:

- `template_product_id` - ID товара-шаблона.
- `front_collection_handle` - handle коллекции лицевых изображений.
- `back_collection_handle` - handle коллекции обратных изображений. Если пусто, используется лицевая коллекция.
- `backend_url` - публичный URL backend без завершающего `/`.
- `title` - пользовательский заголовок карточки.
- `submit_text` - текст кнопки добавления в корзину.
- `preview_aspect_ratio` - пропорция карточек preview, например `10 / 24`.
- `padding_top` и `padding_bottom` - вертикальные отступы.
- `require_back_selection` - требовать выбор обратной стороны.
- `show_description` - показывать описание шаблонного товара.
- `show_properties` - показывать характеристики шаблонного товара.

Важно: сейчас `snippet.liquid` рендерит виджет только на странице с `page.handle == 'konstruktor-tovara-2'`. Если нужна другая страница, измените это условие или уберите его.

## Подготовка InSales

1. Создайте товар-шаблон дакимакуры.
2. Настройте у шаблонного товара варианты, которые влияют на цену: размер, материал и другие параметры.
3. Создайте коллекцию товаров-принтов для лицевой стороны.
4. Создайте коллекцию товаров-принтов для обратной стороны или используйте ту же коллекцию.
5. Убедитесь, что у каждого товара-принта есть главное изображение.
6. Получите доступ к InSales Admin API.
7. Заполните настройки виджета в редакторе InSales.

## Деплой на Render

В проекте есть `render.yaml`, который создает:

- web service `daki-constructor-backend`;
- PostgreSQL database `daki-constructor-db`.

Порядок:

1. Запушьте проект в GitHub.
2. В Render создайте Blueprint из репозитория.
3. Заполните секретные переменные окружения.
4. Дождитесь сборки backend.
5. Проверьте `https://your-service.onrender.com/health`.
6. Вставьте URL backend в настройку `backend_url` виджета.

Render использует:

```yaml
buildCommand: npm ci && npm run build
startCommand: npm run start
```

## Локальная проверка

Минимальная проверка backend:

```powershell
cd backend
npm.cmd install
npm.cmd run check
npm.cmd run build
```

Проверка сервера требует заполненный `.env` и доступную базу PostgreSQL:

```powershell
cd backend
npm.cmd run dev
```

После запуска:

```powershell
Invoke-RestMethod http://localhost:3001/health
```

## Результаты код-ревью

Исправлено в текущей версии:

- `backend/tsconfig.json` теперь собирает `src/server.ts` в `dist/server.js`, поэтому `npm run start` соответствует результату сборки.
- Generated product теперь создается с `is_hidden: true`, как и ожидается по логике проекта.
- `backend/.env.example` разделяет Basic Auth и Bearer token, чтобы случайно не использовать placeholder-значения.
- `render.yaml` переведен на `npm ci`, так как теперь есть `package-lock.json`.

Оставшиеся риски:

- Backend открыт через `cors origin: true` и не требует подпись или токен для `POST /api/constructor/build`. Для production стоит добавить allowlist доменов и секретный токен виджета.
- `POST /api/constructor/build` выполняет всю сборку синхронно внутри HTTP-запроса. При долгих ответах InSales или тяжелых изображениях возможны timeout'ы. Лучше вынести сборку в очередь или background worker.
- `templateVariantId` не хранится отдельной колонкой в `constructor_builds`. Сейчас это не ломает синхронную обработку, но станет проблемой при настоящей фоновой сборке.
- В базе нет `check`-ограничения на допустимые статусы сборки.
- Нет автоматических тестов для выбора варианта, создания товара и обработки ошибок InSales API.
- Виджет жестко привязан к одному `page.handle`, что может сбить с толку при переносе на другую страницу.

## Как запушить в `TooTooG/construktor`

Сейчас эта папка не является git-репозиторием: в ней нет `.git`. Если репозиторий `TooTooG/construktor` пустой или вы хотите отправить текущую папку как первый коммит, выполните из корня проекта:

```powershell
git init
git branch -M main
git add .
git commit -m "Initial constructor app"
git remote add origin https://github.com/TooTooG/construktor.git
git push -u origin main
```

Если GitHub попросит авторизацию, используйте вход через GitHub CLI или personal access token.

Вариант через GitHub CLI:

```powershell
gh auth login
git push -u origin main
```

Если репозиторий на GitHub уже не пустой, безопаснее сначала склонировать его в отдельную папку и перенести файлы:

```powershell
cd "C:\Users\Poligraf 1\Desktop\Модули разработки\Виджет конструктор товара"
git clone https://github.com/TooTooG/construktor.git construktor-github
```

Затем перенесите файлы из `construktor-main` в `construktor-github`, после чего:

```powershell
cd "C:\Users\Poligraf 1\Desktop\Модули разработки\Виджет конструктор товара\construktor-github"
git add .
git commit -m "Add InSales constructor app"
git push
```

Не пушьте:

- `backend/.env`;
- `backend/node_modules`;
- `backend/dist`;
- любые реальные API-ключи InSales.

Эти пути уже закрыты в `.gitignore`, но перед пушем все равно проверьте:

```powershell
git status --short
```
