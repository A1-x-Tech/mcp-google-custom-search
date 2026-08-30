# <img src="./assets/a1-logo.svg" alt="A1" width="40"> Google Custom Search MCP

[English](./README.md) | **Русский**

[![npm](https://img.shields.io/npm/v/mcp-google-custom-search)](https://www.npmjs.com/package/mcp-google-custom-search)
[![CI](https://github.com/A1-x-Tech/mcp-google-custom-search/actions/workflows/ci.yml/badge.svg)](https://github.com/A1-x-Tech/mcp-google-custom-search/actions/workflows/ci.yml)
[![Glama](https://glama.ai/mcp/servers/A1-x-Tech/mcp-google-custom-search/badges/score.svg)](https://glama.ai/mcp/servers/A1-x-Tech/mcp-google-custom-search)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

**A1 Google Custom Search MCP** позволяет AI-приложению искать веб-страницы и картинки на естественном языке через ваш [Programmable Search Engine](https://programmablesearchengine.google.com/). Можно запрашивать страницы, сужать поиск по языку, стране, дате или сайту, листать результаты и получать файлы изображений с миниатюрами.

Сервер работает с Google Custom Search JSON API через ваш API-ключ Google Cloud. Что охватывает поисковая машина — несколько сайтов или весь веб, — решаете вы, а сервер явно показывает ограничения JSON API, а не создаёт впечатление, что через поиск можно сделать всё.

- **3 инструмента.** Поиск по вебу, поиск картинок и «сырой» GET-запрос для параметров, которых нет в типизированных инструментах.
- **Только чтение от начала до конца.** У Custom Search JSON API нет пишущих методов; каждый инструмент помечен как read-only, и ничто здесь не может изменить данные.
- **Охват контролируете вы.** Конфигурация поисковой машины определяет, где идёт поиск; результаты и ранжирование могут отличаться от google.com.
- **Ключ остаётся в заголовке.** Аутентификация по API-ключу — без OAuth и без scope; ключ передаётся в заголовке `X-Goog-Api-Key` и никогда не попадает в URL.
- **Это не Google Search Console.** Сервер не покажет, как индексируется и ранжируется ваш собственный сайт.

Начните с запроса, который только читает данные:

> Найди свежие статьи о внедрении passkey за последний месяц и кратко перескажи три верхних результата.

[Подключить сервер](#быстрый-старт) · [Посмотреть сценарии](#что-можно-поручить) · [Открыть техническую документацию](#техническая-документация)

---

## Увидеть работу за минуту

> **Вы:** Найди свежие статьи о внедрении passkey, только на английском, за последний месяц.
>
> **Ассистент:** Выполняет один поиск через вашу поисковую машину и показывает заголовок, ссылку и сниппет каждого результата. Ничего не меняется — каждый инструмент только читает.
>
> **Вы:** Покажи следующую страницу.
>
> **Ассистент:** Продолжает с курсора `next_start` и показывает результаты 11–20 того же запроса.
>
> **Вы:** Теперь найди крупные пресс-фото на эту же тему.
>
> **Ассистент:** Переключается на поиск картинок и возвращает файлы изображений с размерами, миниатюрами и страницами, на которых они размещены.

## Содержание

- [Быстрый старт](#быстрый-старт)
- [Что можно поручить](#что-можно-поручить)
- [Как работает поиск](#как-работает-поиск)
- [Что может измениться](#что-может-измениться)
- [Как получить доступ](#как-получить-доступ)
- [Конфигурация](#конфигурация)
- [Данные, лимиты и работа в фоне](#данные-лимиты-и-работа-в-фоне)
- [Техническая документация](#техническая-документация)
- [Поддержка](#поддержка)

## Быстрый старт

Нужны Node.js 20+, API-ключ Google Cloud с включённым Custom Search API и id поисковой машины Programmable Search Engine (`cx`).

1. [Получите API-ключ и id поисковой машины](#как-получить-доступ).
2. Добавьте сервер в AI-приложение.
3. Отправьте запрос, который только читает данные.

<details open>
<summary><strong>Codex</strong></summary>

<br>

**В приложении:** откройте **Settings → Plugins → MCP servers**, нажмите **Add server**, затем добавьте `npx -y mcp-google-custom-search@latest` с `GOOGLE_CUSTOM_SEARCH_API_KEY` и `GOOGLE_CUSTOM_SEARCH_ENGINE_ID`.

**В командной строке:**

```bash
codex mcp add google-custom-search \
  --env GOOGLE_CUSTOM_SEARCH_API_KEY=your_api_key \
  --env GOOGLE_CUSTOM_SEARCH_ENGINE_ID=your_engine_id \
  -- npx -y mcp-google-custom-search@latest
```

```bash
codex mcp list
```

[Документация Codex MCP](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)

</details>

<details>
<summary><strong>Claude Code</strong></summary>

<br>

```bash
claude mcp add \
  --env GOOGLE_CUSTOM_SEARCH_API_KEY=your_api_key \
  --env GOOGLE_CUSTOM_SEARCH_ENGINE_ID=your_engine_id \
  --transport stdio --scope user google-custom-search \
  -- npx -y mcp-google-custom-search@latest
```

```bash
claude mcp list
```

[Документация Claude Code MCP](https://code.claude.com/docs/en/mcp)

</details>

<details>
<summary><strong>Claude Desktop</strong></summary>

<br>

Откройте **Settings → Developer → Edit Config** и добавьте:

```json
{
  "mcpServers": {
    "google-custom-search": {
      "command": "npx",
      "args": ["-y", "mcp-google-custom-search@latest"],
      "env": {
        "GOOGLE_CUSTOM_SEARCH_API_KEY": "your_api_key",
        "GOOGLE_CUSTOM_SEARCH_ENGINE_ID": "your_engine_id"
      }
    }
  }
}
```

Если **Edit Config** недоступна, отредактируйте `~/Library/Application Support/Claude/claude_desktop_config.json` на macOS или `%APPDATA%\Claude\claude_desktop_config.json` на Windows.

[Документация Claude Desktop MCP](https://support.claude.com/en/articles/10949351-getting-started-with-local-mcp-servers-on-claude-desktop)

</details>

<details>
<summary><strong>Cursor</strong></summary>

<br>

Добавьте в `~/.cursor/mcp.json` на macOS/Linux или `%USERPROFILE%\.cursor\mcp.json` на Windows:

```json
{
  "mcpServers": {
    "google-custom-search": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "mcp-google-custom-search@latest"],
      "env": {
        "GOOGLE_CUSTOM_SEARCH_API_KEY": "your_api_key",
        "GOOGLE_CUSTOM_SEARCH_ENGINE_ID": "your_engine_id"
      }
    }
  }
}
```

[Документация Cursor MCP](https://cursor.com/docs/mcp)

</details>

<details>
<summary><strong>VS Code</strong></summary>

<br>

Запустите **MCP: Open User Configuration** и добавьте:

```json
{
  "servers": {
    "google-custom-search": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "mcp-google-custom-search@latest"],
      "env": {
        "GOOGLE_CUSTOM_SEARCH_API_KEY": "${input:custom_search_api_key}",
        "GOOGLE_CUSTOM_SEARCH_ENGINE_ID": "${input:custom_search_engine_id}"
      }
    }
  },
  "inputs": [
    { "type": "promptString", "id": "custom_search_api_key", "description": "Google Cloud API key", "password": true },
    { "type": "promptString", "id": "custom_search_engine_id", "description": "Programmable Search Engine id (cx)" }
  ]
}
```

Проверьте сервер командой **MCP: List Servers**.

[Документация VS Code MCP](https://code.visualstudio.com/docs/agent-customization/mcp-servers)

</details>

## Что можно поручить

### Искать в вебе

- Найди свежие руководства по теме и перескажи верхние результаты.
- Ищи только по `docs.python.org` — или везде, кроме сайта, которому вы не доверяете.
- Покажи следующую страницу результатов того же запроса.

### Сузить выдачу

- Только страницы на английском, опубликованные за последний месяц.
- Только PDF-файлы; требуй точную фразу или исключи слово.
- Ограничь выдачу контентом одной страны или материалами с определёнными правами использования.

### Найти картинки

- Найди крупные фотографии по теме — с размерами и миниатюрами.
- Только клипарт или контурные рисунки, чёрно-белые.
- Покажи страницу, с которой взята каждая картинка.

### Выйти за пределы типизированных инструментов

- Вызови API с параметрами, которых нет в типизированных инструментах: `fields` для сокращения ответа, `lowRange`/`highRange`, `hq`.
- Получи «сырой» конверт ответа с promotions и полным `pagemap`.

## Как работает поиск

1. Каждый запрос идёт через **Programmable Search Engine**, который определяется id `cx` — настроенным по умолчанию или переданным в вызове через `engine_id`. Конфигурация машины задаёт охват: список конкретных сайтов или весь веб, если включена опция «Search the entire web».
2. Результаты возвращаются в нормализованном виде — заголовок, URL, сниппет и метаданные — с курсорами `next_start`/`previous_start` для листания. `total_results` — это оценка Google, и при листании она может уменьшаться.
3. API возвращает не больше 10 результатов за вызов и не больше 100 на запрос (`start + num - 1` должно оставаться ≤ 100). Сервер отклоняет более широкое окно до запроса — API ответил бы `400`, потратив единицу квоты.
4. Для поиска картинок в панели управления машины должна быть включена опция **Image search**; иначе API отвечает `400`.

`corrected_query` в ответе — только подсказка об опечатке: результаты всё равно относятся к исходному запросу. И это Programmable Search, а не Google Search Console: API не покажет, как индексируется и ранжируется ваш собственный сайт.

## Что может измениться

| Операция | Что происходит | Граница подтверждения |
|---|---|---|
| Поиск по вебу (`search`) | Читает результаты поиска вашей машины | Ничего не меняет |
| Поиск картинок (`search_images`) | Читает результаты поиска картинок вашей машины | Ничего не меняет |
| «Сырой» запрос API (`raw_request`) | GET по любому пути Custom Search API | Ничего не меняет — у API нет пишущих методов |

Каждый инструмент, включая «сырой» запрос, помечен как read-only. Custom Search JSON API — это один GET-эндпоинт без записи, поэтому единственное, что тратит вызов, — единица дневной квоты.

## Как получить доступ

Google Custom Search аутентифицируется по API-ключу; OAuth и scope здесь не нужны.

1. Создайте или выберите проект Google Cloud и включите **Custom Search API**.
2. Создайте **API-ключ** в **APIs & Services → Credentials**. Хорошая привычка — ограничить ключ только Custom Search API.
3. Создайте **Programmable Search Engine** в [панели управления](https://programmablesearchengine.google.com/controlpanel/create) и скопируйте его **Search engine ID** (`cx`). Включите **Search the entire web** для поиска по всему вебу и **Image search** для инструмента картинок.

Храните API-ключ как пароль. Сервер передаёт его в заголовке `X-Goog-Api-Key`, а не в URL, поэтому залогированные или показанные URL не могут его раскрыть.

## Конфигурация

| Переменная | Обязательна | Описание |
|---|---|---|
| `GOOGLE_CUSTOM_SEARCH_API_KEY` | Да | API-ключ Google Cloud с включённым Custom Search API. Секрет. |
| `GOOGLE_CUSTOM_SEARCH_ENGINE_ID` | Рекомендуется | Id поисковой машины Programmable Search Engine по умолчанию (`cx`); инструменты принимают `engine_id` в каждом вызове. |
| `GOOGLE_CUSTOM_SEARCH_API_BASE` | Нет | Переопределяет базовый URL Custom Search API. |
| `GOOGLE_CUSTOM_SEARCH_TIMEOUT_MS` | Нет | Тайм-аут одного запроса; по умолчанию `30000` мс. |
| `GOOGLE_CUSTOM_SEARCH_MAX_RETRIES` | Нет | Повторы временных ошибок (429/5xx/сеть); по умолчанию `3`. |

Без учётных данных сервер всё равно стартует и завершает MCP-рукопожатие; первый вызов инструмента объяснит, какие именно переменные задать. Единственная некорректная конфигурация — id машины без API-ключа: ключ нельзя передать в вызове, поэтому задавать нужно обе переменные вместе.

## Данные, лимиты и работа в фоне

- **Запросы идут в Google.** Локальный сервер вызывает Custom Search JSON API. Анонимная телеметрия содержит ID установки, версию пакета, версии AI-клиента и платформы и имена инструментов — но не API-ключ, не поисковые запросы, не результаты и не аргументы инструментов. Чтобы отключить её, задайте `ASKADS_TELEMETRY=0`.
- **У Google есть дневная квота.** Каждый вызов любого из трёх инструментов тратит единицу квоты проекта — 100 запросов в день бесплатно, до 10 000 в день с биллингом. При `429` сервер делает паузу, учитывая `Retry-After`; поскольку весь API — идемпотентные GET-запросы, `5xx` и сетевые ошибки тоже повторяются, а `400`/`403` завершаются сразу.
- **Постоянного опроса нет.** Сервер работает только при вызове. Если AI-приложение поддерживает задания по расписанию, оно может периодически повторять поиск — каждый прогон всё так же тратит единицы квоты.

## Техническая документация

- [Каталог MCP-возможностей](./docs/capabilities/index.md) — страницы по пользовательским задачам для каждого инструмента.
- [Все инструменты и параметры](./docs/TOOLS.md)
- [Документация по разработке](./docs/DEVELOPMENT.md)
- [Документация по публикации](./docs/PUBLISHING.md)
- [Справочник Custom Search JSON API](https://developers.google.com/custom-search/v1/overview)

## Поддержка

Нашли ошибку или не хватает сценария? [Создайте issue](https://github.com/A1-x-Tech/mcp-google-custom-search/issues) или напишите в [Telegram](https://t.me/a1_mcp).

<br>

<p align="center">
  <img src="https://github.com/ztemerbekov/a1-yandex-kit-skills/raw/main/assets/images/mona-hifive-yandex-kit-warm.gif" alt="Две Моны дают пять" width="256">
</p>

<p align="center">
  Вы дочитали до конца!
</p>
