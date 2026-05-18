# Backend

Сервис создает реальные товары в InSales для собранных дакимакур.

## Команды

```powershell
cd backend
npm.cmd install
npm.cmd run check
npm.cmd run build
npm.cmd run dev
```

## Переменные окружения

См. `backend/.env.example`

Нужно указать:

- `DATABASE_URL`
- `INSALES_SHOP_URL`
- `APP_BASE_URL`
- либо `INSALES_API_KEY` и `INSALES_API_PASSWORD`
- либо `INSALES_ACCESS_TOKEN`

## Основные маршруты

- `POST /api/constructor/build`
- `GET /api/constructor/build/:id`
- `GET /health`

## Что делает backend

1. Принимает конфигурацию конструктора.
2. Забирает шаблонный товар и выбранные картинки из InSales.
3. Склеивает итоговое preview через `sharp`.
4. Создает новый hidden product через Admin API InSales.
5. Загружает preview как главное изображение.
6. Возвращает созданный `variant_id` для корзины.
