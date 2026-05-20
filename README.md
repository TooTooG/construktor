# Конструктор дакимакуры для InSales

Проект состоит из двух частей:

- `widget/wt_Konstruktor` в репозитории GitHub: виджет InSales 4 поколения, который работает как отдельная карточка-конструктор.
- `backend/`: внешний сервис, который получает конфигурацию, склеивает preview, создает реальный hidden product в InSales и возвращает созданный `variant_id`.

## Как работает поток

1. Пользователь выбирает лицевую сторону, обратную сторону и параметры товара.
2. Виджет отправляет конфигурацию в `POST /api/constructor/build`.
3. Backend:
   - находит шаблонный товар;
   - находит выбранные картинки;
   - склеивает итоговое preview;
   - создает новый hidden product в InSales;
   - загружает preview как главное изображение;
   - возвращает статус сборки.
4. Виджет опрашивает `GET /api/constructor/build/:id`.
5. Когда сборка готова, виджет добавляет в корзину уже реальный созданный `variant_id`.

## Что уже готово

- backend на `Node.js + TypeScript + Fastify`;
- `Postgres`-таблица для хранения сборок;
- загрузка preview в InSales через Admin API;
- импортируемый виджет InSales с настройками:
  - `template_product_id`
  - `front_collection_handle`
  - `back_collection_handle`
  - `backend_url`
  - `padding_top`
  - `padding_bottom`
  - `preview_aspect_ratio`

Подробное развертывание: `DEPLOYMENT.md`
