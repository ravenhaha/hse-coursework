"""replace source_type enum with string

Revision ID: dc5ab4d5a451
Revises: fc1f60686c25
Create Date: 2026-05-13 21:05:53.872074

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'dc5ab4d5a451'
down_revision: Union[str, Sequence[str], None] = 'fc1f60686c25'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 0) Дропаем старый CHECK (имя в БД: ck_materials_source_content_match,
    #    но из-за naming_convention передаём только "хвост")
    op.drop_constraint(
        'source_content_match',
        'materials',
        type_='check',
    )

    # 1) ENUM → VARCHAR(20)
    op.alter_column(
        'materials', 'source_type',
        existing_type=postgresql.ENUM('text', 'file', name='source_type_enum'),
        type_=sa.String(length=20),
        existing_nullable=False,
        postgresql_using='source_type::text',
    )

    # 2) Дропаем осиротевший SQL-тип
    op.execute("DROP TYPE IF EXISTS source_type_enum")

    # 3) Новый CHECK на допустимые значения
    op.create_check_constraint(
        'source_type_valid',
        'materials',
        "source_type IN ('text', 'file')",
    )

    # 4) Восстанавливаем CHECK на согласованность полей
    op.create_check_constraint(
        'source_content_match',
        'materials',
        "(source_type = 'text' "
        " AND text_content IS NOT NULL "
        " AND file_path IS NULL "
        " AND file_size IS NULL "
        " AND extracted_text IS NULL) "
        "OR "
        "(source_type = 'file' "
        " AND file_path IS NOT NULL "
        " AND file_size IS NOT NULL "
        " AND text_content IS NULL)",
    )


def downgrade() -> None:
    op.drop_constraint('source_content_match', 'materials', type_='check')
    op.drop_constraint('source_type_valid', 'materials', type_='check')

    source_type_enum = postgresql.ENUM('text', 'file', name='source_type_enum')
    source_type_enum.create(op.get_bind(), checkfirst=True)

    op.alter_column(
        'materials', 'source_type',
        existing_type=sa.String(length=20),
        type_=source_type_enum,
        existing_nullable=False,
        postgresql_using='source_type::source_type_enum',
    )

    op.create_check_constraint(
        'source_content_match',
        'materials',
        "(source_type = 'text' "
        " AND text_content IS NOT NULL "
        " AND file_path IS NULL "
        " AND file_size IS NULL "
        " AND extracted_text IS NULL) "
        "OR "
        "(source_type = 'file' "
        " AND file_path IS NOT NULL "
        " AND file_size IS NOT NULL "
        " AND text_content IS NULL)",
    )