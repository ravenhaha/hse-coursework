"""tag_name_case_insensitive_unique

Revision ID: fda6469f87bb
Revises: 745174bb88f4
Create Date: 2026-05-29 00:37:39.693434

Меняем строгое UNIQUE(user_id, tag_name) на функциональный индекс
UNIQUE(user_id, lower(tag_name)).

Цель: считать "Физика", "физика" и "ФИЗИКА" одним и тем же тегом
(нельзя создать дубль), но при этом сохранять оригинальный регистр,
который ввёл юзер.
"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'fda6469f87bb'
down_revision: Union[str, Sequence[str], None] = '745174bb88f4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


OLD_UNIQUE_CONSTRAINT = "uq_tags_user_id_tag_name"
NEW_INDEX_NAME = "uq_tags_user_lower_name"


def upgrade() -> None:
    """Upgrade schema."""
    # 1. Удалить старый case-sensitive UNIQUE-констрейнт.
    op.drop_constraint(
        OLD_UNIQUE_CONSTRAINT,
        "tags",
        type_="unique",
    )

    # 2. Создать функциональный UNIQUE INDEX на lower(tag_name).
    #    Через op.execute, потому что op.create_index в старых
    #    версиях Alembic не умеет функциональные выражения.
    op.execute(
        f"CREATE UNIQUE INDEX {NEW_INDEX_NAME} "
        f"ON tags (user_id, lower(tag_name))"
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.execute(f"DROP INDEX IF EXISTS {NEW_INDEX_NAME}")

    # Откат: возвращаем старый case-sensitive UNIQUE.
    op.create_unique_constraint(
        OLD_UNIQUE_CONSTRAINT,
        "tags",
        ["user_id", "tag_name"],
    )