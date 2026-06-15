"""rename collection_name to name

Revision ID: fc1f60686c25
Revises: 20ca8554a5fa
Create Date: 2026-05-13 04:15:09.400815

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'fc1f60686c25'
down_revision: Union[str, Sequence[str], None] = '20ca8554a5fa'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema: rename column collection_name → name (preserves data)."""
    # 1) Переименовываем колонку — данные сохраняются.
    op.alter_column(
        'collections',
        'collection_name',
        new_column_name='name',
    )

    # 2) Переименовываем уникальный индекс под новое имя.
    op.execute(
        'ALTER INDEX uq_collections_user_id_parent_id_collection_name '
        'RENAME TO uq_collections_user_id_parent_id_name'
    )


def downgrade() -> None:
    """Downgrade schema: rename column name → collection_name back."""
    op.execute(
        'ALTER INDEX uq_collections_user_id_parent_id_name '
        'RENAME TO uq_collections_user_id_parent_id_collection_name'
    )

    op.alter_column(
        'collections',
        'name',
        new_column_name='collection_name',
    )