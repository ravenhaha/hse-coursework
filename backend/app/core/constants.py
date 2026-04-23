# НОВЫЙ ФАЙЛ: единое место для sentinel-значений
# Раньше _UNSET жил в services/collection.py — это приватный объект,
# импортировать его в роутер было некрасиво.
# Теперь и сервис и роутер берут UNSET отсюда.

from typing import Any

UNSET: Any = object()