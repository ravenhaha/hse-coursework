"""add extracted_text and file_size to materials,
   plus is_active to users and password_hash to auth_accounts

Revision ID: 1fa8d30e18d4
Revises: ba8c99fa367f
Create Date: 2026-05-12 20:26:34.065121
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '1fa8d30e18d4'
down_revision: Union[str, Sequence[str], None] = 'ba8c99fa367f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # --- auth_accounts: password_hash для email-регистрации ---
    op.add_column(
        'auth_accounts',
        sa.Column('password_hash', sa.String(length=255), nullable=True),
    )

    # --- users: флаг активности ---
    op.add_column(
        'users',
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
    )

    # --- materials: новые поля для файлов ---
    op.add_column(
        'materials',
        sa.Column('file_size', sa.BigInteger(), nullable=True),
    )
    op.add_column(
        'materials',
        sa.Column('extracted_text', sa.Text(), nullable=True),
    )

    # --- materials: обновляем CHECK constraint ---
    # Префикс 'ck_materials_' добавляется автоматически через naming convention
    op.drop_constraint(
        'source_content_match',
        'materials',
        type_='check',
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


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint(
        'source_content_match',
        'materials',
        type_='check',
    )
    op.create_check_constraint(
        'source_content_match',
        'materials',
        "(source_type = 'text' AND text_content IS NOT NULL AND file_path IS NULL) "
        "OR (source_type = 'file' AND file_path IS NOT NULL AND text_content IS NULL)",
    )

    op.drop_column('materials', 'extracted_text')
    op.drop_column('materials', 'file_size')
    op.drop_column('users', 'is_active')
    op.drop_column('auth_accounts', 'password_hash')