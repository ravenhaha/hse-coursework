"""add server_default to materials.is_important

Revision ID: c4ed2f8b2a98
Revises: e656d6f115b4
Create Date: 2026-05-29 15:48:27.412425

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c4ed2f8b2a98'
down_revision: Union[str, Sequence[str], None] = 'e656d6f115b4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Добавляем server_default='false' для materials.is_important.

    Зачем: чтобы прямые INSERT'ы в БД (мимо ORM) и старые миграции,
    которые добавляют колонку без default, не падали с NOT NULL violation.
    ORM-default (default=False в модели) остаётся для удобства Python-кода.

    Существующие строки НЕ затрагиваются — server_default применяется
    только к новым INSERT'ам, где колонка не указана явно.
    """
    op.alter_column(
        'materials',
        'is_important',
        existing_type=sa.Boolean(),
        existing_nullable=False,
        server_default=sa.text('false'),
    )


def downgrade() -> None:
    """Убираем server_default.

    Существующие данные не трогаем — только метаданные колонки.
    """
    op.alter_column(
        'materials',
        'is_important',
        existing_type=sa.Boolean(),
        existing_nullable=False,
        server_default=None,
    )