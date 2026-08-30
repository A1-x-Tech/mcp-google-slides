# <img src="./assets/a1-logo.svg" alt="A1" width="40"> Google Slides MCP

[English](./README.md) | **Русский**

[![npm](https://img.shields.io/npm/v/%40a1-x-tech%2Fmcp-google-slides)](https://www.npmjs.com/package/@a1-x-tech/mcp-google-slides)
[![CI](https://github.com/A1-x-Tech/mcp-google-slides/actions/workflows/ci.yml/badge.svg)](https://github.com/A1-x-Tech/mcp-google-slides/actions/workflows/ci.yml)
[![Glama](https://glama.ai/mcp/servers/A1-x-Tech/mcp-google-slides/badges/score.svg)](https://glama.ai/mcp/servers/A1-x-Tech/mcp-google-slides)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

**A1 Google Slides MCP** позволяет AI-приложению создавать и редактировать презентации Google Slides на естественном языке. Можно собрать презентацию, добавить и переставить слайды, написать и оформить текст, разместить фигуры, изображения и таблицы, вести заметки докладчика, разобрать комментарии и выгрузить результат в PDF или PPTX.

Сервер работает с Google Slides API через ваш Google-аккаунт. Всё внутри презентации адресуется явными object id, а ограничения Slides API сервер называет прямо, вместо того чтобы делать вид, будто с презентацией возможно всё.

- **26 инструментов.** Проверка презентаций и страниц, редактирование слайдов, текста, фигур, изображений и таблиц, заметки докладчика и комментарии, миниатюры и экспорт файлов.
- **Правки атомарны.** Изменения идут через `batchUpdate` API: один неверный запрос отменяет весь пакет, поэтому презентация не остаётся отредактированной наполовину.
- **Ваш Drive недосягаем.** Комментарии, экспорт и загрузка локальных изображений используют Drive API строго для одного файла презентации — инструментов, чтобы перечислять, расшаривать, переименовывать или удалять файлы Drive, нет.
- **Минимальные scope Google.** Нужен `presentations`; scope Drive требуются только для локальных изображений, комментариев и экспорта.

Начните с запроса, который только читает данные:

> Покажи слайды квартального отчёта и что на каждом из них.

[Подключить сервер](#быстрый-старт) · [Посмотреть сценарии](#что-можно-поручить) · [Открыть техническую документацию](#техническая-документация)

---

## Увидеть работу за минуту

> **Вы:** Перечисли слайды презентации с обзором Q3 и что на каждом.
>
> **Ассистент:** Показывает компактную опись: позицию каждого слайда, его макет и элементы с видимым текстом. Ничего не меняется.
>
> **Вы:** Подготовь новый слайд после повестки с заголовком «Roadmap» и ключевыми датами в теле.
>
> **Ассистент:** Показывает целевую презентацию, макет и предлагаемый текст, затем запрашивает подтверждение перед добавлением.
>
> **Вы:** Подтверждаю.
>
> **Ассистент:** Добавляет слайд и заполняет его плейсхолдеры. Остальные слайды он не трогает.

## Содержание

- [Быстрый старт](#быстрый-старт)
- [Что можно поручить](#что-можно-поручить)
- [Как меняется презентация](#как-меняется-презентация)
- [Что может измениться](#что-может-измениться)
- [Как получить доступ](#как-получить-доступ)
- [Конфигурация](#конфигурация)
- [Данные, лимиты и работа в фоне](#данные-лимиты-и-работа-в-фоне)
- [Техническая документация](#техническая-документация)
- [Поддержка](#поддержка)

## Быстрый старт

Нужны Node.js 20+, Google-аккаунт и OAuth-данные из проекта Google Cloud с включённым Google Slides API.

1. [Подготовьте Google OAuth-доступ](#как-получить-доступ).
2. Добавьте сервер в AI-приложение.
3. Отправьте запрос, который только читает данные.

<details open>
<summary><strong>Codex</strong></summary>

<br>

**В приложении:** откройте **Settings → Plugins → MCP servers**, нажмите **Add server**, затем добавьте `npx -y @a1-x-tech/mcp-google-slides@latest` с `GOOGLE_SLIDES_CLIENT_ID`, `GOOGLE_SLIDES_CLIENT_SECRET` и `GOOGLE_SLIDES_REFRESH_TOKEN`.

**В командной строке:**

```bash
codex mcp add google-slides \
  --env GOOGLE_SLIDES_CLIENT_ID=your_client_id \
  --env GOOGLE_SLIDES_CLIENT_SECRET=your_client_secret \
  --env GOOGLE_SLIDES_REFRESH_TOKEN=your_refresh_token \
  -- npx -y @a1-x-tech/mcp-google-slides@latest
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
  --env GOOGLE_SLIDES_CLIENT_ID=your_client_id \
  --env GOOGLE_SLIDES_CLIENT_SECRET=your_client_secret \
  --env GOOGLE_SLIDES_REFRESH_TOKEN=your_refresh_token \
  --transport stdio --scope user google-slides \
  -- npx -y @a1-x-tech/mcp-google-slides@latest
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
    "google-slides": {
      "command": "npx",
      "args": ["-y", "@a1-x-tech/mcp-google-slides@latest"],
      "env": {
        "GOOGLE_SLIDES_CLIENT_ID": "your_client_id",
        "GOOGLE_SLIDES_CLIENT_SECRET": "your_client_secret",
        "GOOGLE_SLIDES_REFRESH_TOKEN": "your_refresh_token"
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
    "google-slides": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@a1-x-tech/mcp-google-slides@latest"],
      "env": {
        "GOOGLE_SLIDES_CLIENT_ID": "your_client_id",
        "GOOGLE_SLIDES_CLIENT_SECRET": "your_client_secret",
        "GOOGLE_SLIDES_REFRESH_TOKEN": "your_refresh_token"
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
    "google-slides": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@a1-x-tech/mcp-google-slides@latest"],
      "env": {
        "GOOGLE_SLIDES_CLIENT_ID": "${input:slides_client_id}",
        "GOOGLE_SLIDES_CLIENT_SECRET": "${input:slides_client_secret}",
        "GOOGLE_SLIDES_REFRESH_TOKEN": "${input:slides_refresh_token}"
      }
    }
  },
  "inputs": [
    { "type": "promptString", "id": "slides_client_id", "description": "Google OAuth client ID" },
    { "type": "promptString", "id": "slides_client_secret", "description": "Google OAuth client secret", "password": true },
    { "type": "promptString", "id": "slides_refresh_token", "description": "Google OAuth refresh token", "password": true }
  ]
}
```

Проверьте сервер командой **MCP: List Servers**.

[Документация VS Code MCP](https://code.visualstudio.com/docs/agent-customization/mcp-servers)

</details>

## Что можно поручить

### Проверить презентацию

- Перечисли слайды этой презентации и что на каждом.
- Прочитай заметки докладчика к пятому слайду.
- Отрисуй миниатюру титульного слайда.

### Собрать и переставить слайды

- Создай презентацию для обзора Q3.
- Добавь слайд «Roadmap» после повестки, продублируй слайд-шаблон, перенеси итоги в конец.
- Вставь изображение по URL или из локального файла, добавь таблицу 4×3, создай текстовый блок или скруглённый прямоугольник с подписью.

### Написать и отшлифовать текст

- Помести этот текст в плейсхолдер заголовка и выдели дедлайн жирным красным.
- Замени «Q2» на «Q3» по всей презентации.
- Сократи заметки докладчика к третьему слайду.

### Разобрать и передать дальше

- Перечисли открытые ветки комментариев и ответь на первую, закрыв её как решённую.
- Удали черновой слайд, который больше не нужен.
- Выгрузи презентацию в PDF или PPTX для того, у кого нет доступа к Google.

## Как меняется презентация

1. `create_presentation` создаёт **презентацию** с одним титульным слайдом; при создании учитывается только название.
2. Всё внутри презентации — слайды, фигуры, изображения, таблицы — адресуется **object id**. `list_slides` — компактная опись, с которой стоит начинать перед любой правкой.
3. Правки идут через атомарный `batchUpdate` API: один неверный запрос отменяет весь пакет, поэтому ничего не применяется наполовину.
4. Входные значения инструментов — в пунктах; API хранит EMU (1 pt = 12700 EMU). Сервер конвертирует в обе стороны.

Slides API не может удалить, переименовать или расшарить файл презентации — это файловые операции Drive за пределами этого сервера. Он не может импортировать тему (только применять макеты, которые уже есть в презентации) и не может привязать новый комментарий к конкретному слайду. Экспорт ограничен 10 МБ, а ссылки на миниатюры истекают примерно через 30 минут.

## Что может измениться

| Операция | Что происходит | Граница подтверждения |
|---|---|---|
| Проверка презентации, страницы, заметок или комментариев; миниатюра; экспорт файла | Читает данные, пишет только локальные файлы | Ничего не меняет |
| Создание презентации | Добавляет новую презентацию в ваш Google-аккаунт | Меняет Google Slides |
| Добавление, дублирование или перемещение слайдов; создание фигур, изображений, таблиц | Добавляет или переставляет содержимое презентации | Меняет презентацию |
| Установка или оформление текста, замена изображения, трансформация элемента, правка заметок докладчика или структуры таблицы | Перезаписывает существующее содержимое | Меняет презентацию |
| Поиск и замена по всей презентации | Меняет все совпадения разом | Меняет презентацию целиком |
| Удаление слайда, элемента или ветки комментариев | Удаляет содержимое без отмены через API | Разрушительно |
| Технический `batchUpdate` или технический запрос API | Может вызвать метод API без отдельного инструмента | Потенциально разрушительно |

Как AI-приложение просит подтверждение, определяет само приложение. Сервер помечает операции чтения, записи и удаления, чтобы оно отличило проверку от рабочего изменения.

## Как получить доступ

Google Slides требует OAuth 2.0: одного API-ключа недостаточно.

1. Создайте или выберите проект Google Cloud и включите **Google Slides API**. Также включите **Google Drive API**, если нужны комментарии, экспорт или загрузка локальных изображений.
2. Настройте OAuth consent screen и создайте OAuth-клиент типа **Desktop app**.
3. Авторизуйте Google-аккаунт, который владеет презентациями или может их редактировать. [OAuth 2.0 Playground](https://developers.google.com/oauthplayground) поможет получить refresh token, если включить **Use your own OAuth credentials**.
4. Запросите scope:

   ```text
   https://www.googleapis.com/auth/presentations
   https://www.googleapis.com/auth/drive.file
   ```

   `presentations` покрывает все чтения и записи Slides. `drive.file` покрывает загрузку локальных изображений, а также комментарии и экспорт для презентаций, созданных через это приложение; запросите более широкий `https://www.googleapis.com/auth/drive`, если комментарии или экспорт нужны для произвольных презентаций.

Refresh token OAuth-приложения в режиме Testing может истечь через семь дней. Для долгого доступа опубликуйте OAuth-приложение или используйте Internal-приложение в домене Workspace. Храните client secret и refresh token как пароли.

## Конфигурация

| Переменная | Обязательна | Описание |
|---|---|---|
| `GOOGLE_SLIDES_CLIENT_ID` | Да* | OAuth client ID. |
| `GOOGLE_SLIDES_CLIENT_SECRET` | Да* | OAuth client secret. |
| `GOOGLE_SLIDES_REFRESH_TOKEN` | Да* | OAuth refresh token. |
| `GOOGLE_SLIDES_ACCESS_TOKEN` | Да* | Короткоживущая (~1 ч) альтернатива OAuth-тройке. |
| `GOOGLE_SLIDES_API_BASE` | Нет | Переопределяет базовый URL Google Slides API. |
| `GOOGLE_SLIDES_DRIVE_API_BASE` | Нет | Переопределяет базовый URL Google Drive API (внутренняя зависимость: комментарии, экспорт, загрузка изображений). |
| `GOOGLE_SLIDES_TIMEOUT_MS` | Нет | Тайм-аут одного запроса; по умолчанию `60000` мс. |
| `GOOGLE_SLIDES_MAX_RETRIES` | Нет | Повторы временных ошибок; по умолчанию `3`. |

\* Передайте OAuth-тройку или access token.

## Данные, лимиты и работа в фоне

- **Запросы идут в Google Slides.** Локальный сервер обновляет OAuth-токены Google и вызывает Slides API; комментарии, экспорт и загрузка локальных изображений проходят через Drive API строго для одного файла презентации. Анонимная телеметрия содержит ID установки, версию пакета, версии AI-клиента и платформы и имена инструментов — но не OAuth-токены, содержимое презентаций, аргументы или промпты. Чтобы отключить её, задайте `ASKADS_TELEMETRY=0`.
- **У Google есть лимиты частоты.** При `429` сервер использует задержку; чтение также повторяется после сетевых и `5xx` ошибок, а запись после неопределённой ошибки не повторяется. Миниатюры расходуют более дорогую квоту чтения.
- **Постоянного опроса нет.** Сервер работает только при вызове. Между вызовами за презентацией никто не следит; если AI-приложение поддерживает задания по расписанию, оно может периодически её проверять.

## Техническая документация

- [Каталог MCP-возможностей](./docs/capabilities/index.md) — страницы по пользовательским задачам для каждого инструмента.
- [Все инструменты и параметры](./docs/TOOLS.md)
- [Документация по разработке](./docs/DEVELOPMENT.md)
- [Документация по публикации](./docs/PUBLISHING.md)
- [Справочник Google Slides API](https://developers.google.com/slides/api)

## Поддержка

Нашли ошибку или не хватает сценария? [Создайте issue](https://github.com/A1-x-Tech/mcp-google-slides/issues) или напишите в [Telegram](https://t.me/a1_mcp).

<br>

<p align="center">
  <img src="https://github.com/ztemerbekov/a1-yandex-kit-skills/raw/main/assets/images/mona-hifive-yandex-kit-warm.gif" alt="Две Моны дают пять" width="256">
</p>

<p align="center">
  Вы дочитали до конца!
</p>
