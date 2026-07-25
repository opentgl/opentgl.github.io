# Открытый Тольятти

Портал открытых данных города Тольятти — транспорт, культура, образование, спорт, здравоохранение, недвижимость и инфраструктура.

## О сайте

**Открытый Тольятти** — независимый портал для просмотра открытых данных города Тольятти. Данные получены из открытых источников Администрации г.о. Тольятти.

> **Примечание:** В будущем данные будут загружаться из Google Sheets (только чтение).

## Локальный запуск

Просто откройте `public/index.html` в браузере или запустите любой статический сервер:

```bash
# Сборка статических данных из CSV (если меняли CSV)
node scripts/build-static.js

# Python
python3 -m http.server -d public 8080

# Node.js
npx serve public
```

Откройте **http://localhost:8080** в браузере.

## Структура проекта

```
opentgl/
├── scripts/
│   ├── build-static.js            # Сборка CSV → JSON для статического сайта
│   └── download_gdrive_data.py    # Загрузка данных из Google Drive
├── public/                        # Корень статического сайта (деплоится на Pages)
│   ├── index.html                 # SPA (только Bootstrap классы)
│   ├── favicon.svg                # Иконка
│   ├── css/
│   │   └── style.css              # Минимальный CSS (sidebar, layout)
│   ├── js/                        # ES-модули
│   │   ├── app.js                 # Точка входа
│   │   ├── router.js              # Hash-роутер + навигация
│   │   ├── api.js                 # Загрузка статических JSON
│   │   ├── state.js               # Центральное хранилище
│   │   ├── utils.js               # Утилиты (escapeHtml, formatDate)
│   │   └── pages/                 # Страницы
│   │       ├── home.js            # Главная
│   │       ├── category.js        # Категория
│   │       ├── detail.js          # Детальный просмотр
│   │       └── about.js           # О сайте
│   └── data/                      # Сгенерированные статические данные (gitignored)
│       ├── csvs-meta.json         # Метаданные всех CSV-файлов
│       └── csv/                   # Преобразованные CSV → JSON
├── example.csv/                   # 25 CSV-файлов с данными Тольятти
├── .github/workflows/
│   ├── static.yml                 # Деплой на GitHub Pages
│   └── download-data.yml          # Загрузка из Google Drive
├── geo.json                       # Геокодер (координаты)
├── .env.example                   # Переменные для загрузчика
├── requirements-download.txt      # Python-зависимости
├── favicon.svg                    # Иконка (оригинал)
└── README.md                      # Этот файл
```

## Стек технологий

- **Bootstrap 5** — единственная CSS-библиотека (CDN), все стили через utility-классы
- **Lucide Icons** — иконки, подключаются через CDN
- **ES-модули** — JavaScript код разделён на модули (без сборщиков, нативные import/export)
- **Node.js (build-time)** — сборка статических данных из CSV в JSON (`scripts/build-static.js`)
- **GitHub Pages** — хостинг статического сайта
- **Без кастомных стилей** — все классы в HTML — Bootstrap (d-*, p-*, m-*, bg-*, text-*, flex-*, col-*, card, table, badge, btn, spinner и т.д.)

## Структура страниц

| Маршрут | Описание |
|---------|----------|
| / | Главная — даты и карточки категорий |
| /category/:cat | Список записей категории |
| /category/:cat/:sub | Записи подкатегории |
| /item/:file/:idx | Детальный просмотр записи |
| /about | О сайте |

## Навигация

- **Верхняя панель (navbar)** — Главная, О сайте. Залипает сверху.
- **Боковая панель (sidebar)** — Список всех категорий с количеством файлов. Видна на desktop.
- **Подвал (footer)** — Источники данных, лицензия, авторство.

## Статические данные

CSV-файлы преобразуются в JSON во время сборки (`scripts/build-static.js`) и сохраняются в `public/data/`:

| Файл | Описание |
|------|----------|
| `data/csvs-meta.json` | Список всех CSV-файлов с метаданными (категория, дата, подкатегория) |
| `data/csv/{filename}.json` | Распарсенные CSV-данные — `{ headers, rows, objects }` |

## Данные

25 CSV-файлов, сгруппированных в 10 категорий:

| Категория | Файлов | Подкатегории |
|-----------|--------|--------------|
| Транспорт | 3 | Автобусы, троллейбусы, коммерческие |
| Культура | 6 | Библиотеки, музеи, театры, досуг, наследие, особо ценные |
| Образование | 3 | Школы, дополнительное, дошкольное |
| Спорт | 3 | Бассейны, спортивные школы, физкультура |
| Здравоохранение | 1 | Учреждения здравоохранения |
| Социальная поддержка | 1 | Социальная поддержка |
| Достопримечательности | 1 | Знаковые места |
| Справочная | 2 | Сотрудники, организации |
| Недвижимость | 3 | Земельные участки, нежилые, строительство |
| Инфраструктура | 2 | Инженерные объекты, таксофоны |

## Загрузка данных из Google Drive

Данные могут автоматически загружаться из Google Drive папки при каждом пуше в `main` ветку или вручную через `workflow_dispatch`.

### Настройка

1. Создайте Service Account в Google Cloud Console
2. Дайте ему доступ к нужной папке Google Drive (Role: Viewer)
3. Скачайте JSON ключ Service Account
4. Добавьте секреты в GitHub:
   - `GOOGLE_DRIVE_FOLDER` — ID папки в Google Drive (из URL: `drive.google.com/drive/folders/FOLDER_ID`)
   - `GOOGLE_SERVICE_ACCOUNT_JSON` — содержимое JSON файла ключа

### Переменные окружения

| Переменная | Назначение |
|-----------|------------|
| `GOOGLE_DRIVE_FOLDER` | ID папки Google Drive |
| `GOOGLE_SHEET_FOLDER` | Алиас для `GOOGLE_DRIVE_FOLDER` |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | JSON Service Account (секрет GitHub) |
| `GOOGLE_SERVICE_ACCOUNT_FILE` | Путь к JSON файлу (локально) |
| `OUTPUT_DIR` | Директория для выгрузки (по умолчанию: `example.csv`) |

### Локальный запуск

```bash
export GOOGLE_DRIVE_FOLDER="your-folder-id"
export GOOGLE_SERVICE_ACCOUNT_JSON="$(cat path/to/service-account.json)"
pip install -r requirements-download.txt
python scripts/download_gdrive_data.py
```

### Workflow

1. **`download-data.yml`** — скачивает CSV из Google Drive → `example.csv/`, коммитит. Триггеры: пуш в `main`, ручной запуск, расписание каждые 6 часов.
2. **`static.yml`** — запускает `scripts/build-static.js` (преобразует CSV → JSON), деплоит `public/` на GitHub Pages. Триггеры: пуш в `main`, ручной запуск.

## Автор

Приложение является независимым и создано в информационных целях. Автор не связан с администрацией города Тольятти.
Данные распространяются по лицензии [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
