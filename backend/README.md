# Backend

Сервис создает реальные товары в InSales для собранных дакимакур.

## Что уже заложено

- `Fastify` API
- `Postgres` для состояния сборок
- `sharp` для склейки preview из двух изображений
- сервис `InSalesClient` для создания товара, варианта и главного изображения
- асинхронный сценарий `build -> poll status -> add real variant to cart`

## Команды

Если PowerShell блокирует `npm`, используйте `npm.cmd`:

```powershell
cd backend
npm.cmd install
npm.cmd run check
npm.cmd run dev
```

## SQL

Начальную схему смотрите в `sql/001_init.sql`.
