"""Rate limiter для защиты от брутфорса и злоупотреблений.

Лимитер вынесен в отдельный модуль, чтобы избежать циклического импорта:
    - main.py регистрирует limiter в app.state и обработчик ошибок;
    - api/auth.py импортирует limiter отсюда для декораторов на эндпоинтах.

Ключ лимита — IP клиента (get_remote_address). За обратным прокси
(nginx) нужно, чтобы прокси прокидывал реальный IP в X-Forwarded-For,
иначе все запросы будут считаться с одного адреса. Для MVP это
приемлемо.

Хранилище счётчиков — in-memory (по умолчанию). При нескольких воркерах
uvicorn лимиты считаются на каждый воркер отдельно — для учебного
прототипа это допустимо. Прод-вариант: storage_uri="redis://...".
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
