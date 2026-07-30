# Открытый Тольятти
![GitHub License](https://img.shields.io/github/license/opentgl/opentgl.github.io)
![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/opentgl/opentgl.github.io/astro.yml)
![GitHub commit activity](https://img.shields.io/github/commit-activity/m/opentgl/opentgl.github.io)
![Website](https://img.shields.io/website?url=https%3A%2F%2Fopentgl.github.io)

Портал открытых данных города Тольятти — транспорт, культура, образование, спорт, здравоохранение, недвижимость и инфраструктура.

Статический сайт, сгенерированный [Astro](https://astro.build). Данные — из Google Sheets (или CSV-файлов для fallback), все страницы предварительно отрендерены на этапе сборки.

## Подготовка

Скопируйте `.env.example` в `.env` и заполните:

```bash
cp .env.example .env
```

### Google Sheets (основной источник)

1. Включите [Google Sheets API](https://console.cloud.google.com/apis/library/sheets.googleapis.com) в Google Cloud Console
2. Создайте API-ключ и укажите его в `GOOGLE_API`
3. Создайте Google Spreadsheet с листами, названия которых совпадают с именами CSV-файлов (см. `categories.js`)
4. Сделайте таблицу доступной для чтения всем, у кого есть ссылка
5. ID таблицы (из URL) укажите в `GOOGLE_SPREADSHEET_ID`

Без `GOOGLE_SPREADSHEET_ID` данные читаются из локальных CSV-файлов (директория `example.csv/`).

## Локальный запуск

```bash
npm install
npm run dev
```

Сборка для продакшна:

```bash
npm run build
npm run preview  # просмотр собранного сайта
```

## Структура проекта

```
opentgl/
├── astro.config.mjs               # Конфиг Astro (site, base для GitHub Pages)
├── src/
│   ├── layouts/Layout.astro       # Базовый layout (SEO, хедер, герой, футер)
│   ├── components/
│   │   ├── Navbar.astro           # Верхняя навигация
│   │   ├── NavStrip.astro         # Стрип категорий
│   │   ├── DataTable.astro        # Таблица с данными
│   │   └── Footer.astro           # Подвал
│   ├── pages/
│   │   ├── index.astro            # Главная
│   │   ├── about.astro            # О сайте
│   │   └── category/
│   │       └── [category].astro   # Страница категории
│   └── lib/
│       ├── parse-csv.js           # Парсинг CSV (fallback)
│       ├── google-sheets.js       # Google Sheets API
│       ├── categories.js          # Категории
│       ├── column-map.js          # Унификация названий столбцов
│       └── csv-data.js            # Загрузка данных
├── public/
│   ├── favicon.svg
│   └── css/style.css
├── .github/workflows/
│   └── astro.yml                  # Деплой на GitHub Pages
```

## Страницы

| Маршрут | Описание |
|---------|----------|
| `/` | Главная — карточки категорий |
| `/category/:cat` | Список записей категории |
| `/about` | О сайте |

## Категории

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

## Данные

Данные получены из открытых источников Администрации г.о. Тольятти.
Распространяются по лицензии [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

При сборке данные загружаются через Google Sheets API (по `GOOGLE_SPREADSHEET_ID`).
Если `GOOGLE_SPREADSHEET_ID` не задан — данные читаются из локальных CSV-файлов.

## Стек

<img height="14" width="14" src="https://cdn.simpleicons.org/astro/white" /> **Astro** — генерация статических страниц

<img height="14" width="14" src="https://cdn.simpleicons.org/bootstrap/white" /> **Bootstrap 5** — CSS (CDN)

<img height="14" width="14" src="https://cdn.simpleicons.org/lucide/white" /> **Lucide Icons** — иконки (CDN)

<img height="14" width="14" src="https://cdn.simpleicons.org/github/white" /> **GitHub Pages** — хостинг

## Автор

Независимый проект, не связан с администрацией города Тольятти.
