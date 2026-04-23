"""add_material_tags_and_updates

Revision ID: 8f1ade86b5f5
Revises: 30c860acd59c
Create Date: 2026-04-17 21:39:18.064285

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '8f1ade86b5f5'
down_revision: Union[str, Sequence[str], None] = '30c860acd59c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""

    # 1. Создаём таблицу auth_accounts
    op.create_table('auth_accounts',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('provider_auth', sa.String(length=50), nullable=False),
        sa.Column('provider_user_id', sa.String(length=255), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('provider_auth', 'provider_user_id', name='uq_auth_provider_user_id')
    )
    op.create_index(op.f('ix_auth_accounts_user_id'), 'auth_accounts', ['user_id'], unique=False)

    # 2. Collections: title -> collection_name
    op.add_column('collections', sa.Column('collection_name', sa.String(length=500), nullable=True))
    op.execute("UPDATE collections SET collection_name = title")
    op.alter_column('collections', 'collection_name', nullable=False)
    op.create_unique_constraint('uq_collection_user_parent_name', 'collections', ['user_id', 'parent_id', 'collection_name'])
    op.drop_column('collections', 'title')

    # 3. Materials: title -> material_name
    op.add_column('materials', sa.Column('material_name', sa.String(length=100), nullable=True))
    op.execute("UPDATE materials SET material_name = title")
    op.alter_column('materials', 'material_name', nullable=False)
    op.drop_column('materials', 'title')

    # 4. Materials: source_type VARCHAR -> ENUM
    #    СНАЧАЛА создаём тип, ПОТОМ используем
    source_type_enum = sa.Enum('text', 'file', name='source_type_enum')
    source_type_enum.create(op.get_bind(), checkfirst=True)

    op.alter_column('materials', 'source_type',
               existing_type=sa.VARCHAR(length=50),
               type_=sa.Enum('text', 'file', name='source_type_enum'),
               existing_nullable=False,
               postgresql_using='source_type::source_type_enum')

    # 5. Materials: file_path TEXT -> VARCHAR(500)
    op.alter_column('materials', 'file_path',
               existing_type=sa.TEXT(),
               type_=sa.String(length=500),
               existing_nullable=True)

    # 6. Tags: name -> tag_name + добавляем created_at
    op.add_column('tags', sa.Column('tag_name', sa.String(length=100), nullable=True))
    op.add_column('tags', sa.Column('created_at', sa.DateTime(timezone=True), nullable=True))
    op.execute("UPDATE tags SET tag_name = name, created_at = NOW()")
    op.alter_column('tags', 'tag_name', nullable=False)
    op.alter_column('tags', 'created_at', nullable=False)
    op.create_unique_constraint('uq_tag_user_name', 'tags', ['user_id', 'tag_name'])
    op.drop_column('tags', 'name')

    # 7. Users: email -> user_email, удаляем старые колонки
    op.add_column('users', sa.Column('user_email', sa.String(length=255), nullable=True))
    op.execute("UPDATE users SET user_email = email")

    op.alter_column('users', 'avatar_url',
               existing_type=sa.TEXT(),
               type_=sa.String(length=500),
               existing_nullable=True)
    op.execute("UPDATE users SET updated_at = NOW() WHERE updated_at IS NULL")
    op.alter_column('users', 'updated_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=False)

    op.drop_index(op.f('ix_users_email'), table_name='users')
    op.drop_index(op.f('ix_users_username'), table_name='users')
    op.drop_constraint(op.f('users_vk_id_key'), 'users', type_='unique')
    op.drop_constraint(op.f('users_yandex_id_key'), 'users', type_='unique')
    op.create_index(op.f('ix_users_user_email'), 'users', ['user_email'], unique=True)
    op.drop_column('users', 'vk_id')
    op.drop_column('users', 'yandex_id')
    op.drop_column('users', 'username')
    op.drop_column('users', 'email')


def downgrade() -> None:
    """Downgrade schema."""

    # Users
    op.add_column('users', sa.Column('email', sa.VARCHAR(length=255), autoincrement=False, nullable=True))
    op.add_column('users', sa.Column('username', sa.VARCHAR(length=100), autoincrement=False, nullable=True))
    op.add_column('users', sa.Column('yandex_id', sa.VARCHAR(length=100), autoincrement=False, nullable=True))
    op.add_column('users', sa.Column('vk_id', sa.VARCHAR(length=100), autoincrement=False, nullable=True))
    op.execute("UPDATE users SET email = user_email, username = COALESCE(display_name, 'unknown')")
    op.alter_column('users', 'username', nullable=False)
    op.drop_index(op.f('ix_users_user_email'), table_name='users')
    op.create_unique_constraint(op.f('users_yandex_id_key'), 'users', ['yandex_id'])
    op.create_unique_constraint(op.f('users_vk_id_key'), 'users', ['vk_id'])
    op.create_index(op.f('ix_users_username'), 'users', ['username'], unique=True)
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)
    op.alter_column('users', 'updated_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True)
    op.alter_column('users', 'avatar_url',
               existing_type=sa.String(length=500),
               type_=sa.TEXT(),
               existing_nullable=True)
    op.drop_column('users', 'user_email')

    # Tags
    op.add_column('tags', sa.Column('name', sa.VARCHAR(length=100), autoincrement=False, nullable=True))
    op.execute("UPDATE tags SET name = tag_name")
    op.alter_column('tags', 'name', nullable=False)
    op.drop_constraint('uq_tag_user_name', 'tags', type_='unique')
    op.drop_column('tags', 'created_at')
    op.drop_column('tags', 'tag_name')

    # Materials: source_type ENUM -> VARCHAR
    op.alter_column('materials', 'source_type',
               existing_type=sa.Enum('text', 'file', name='source_type_enum'),
               type_=sa.VARCHAR(length=50),
               existing_nullable=False,
               postgresql_using='source_type::varchar')
    sa.Enum(name='source_type_enum').drop(op.get_bind(), checkfirst=True)

    op.alter_column('materials', 'file_path',
               existing_type=sa.String(length=500),
               type_=sa.TEXT(),
               existing_nullable=True)

    # Materials: material_name -> title
    op.add_column('materials', sa.Column('title', sa.VARCHAR(length=200), autoincrement=False, nullable=True))
    op.execute("UPDATE materials SET title = material_name")
    op.alter_column('materials', 'title', nullable=False)
    op.drop_column('materials', 'material_name')

    # Collections: collection_name -> title
    op.add_column('collections', sa.Column('title', sa.VARCHAR(length=200), autoincrement=False, nullable=True))
    op.execute("UPDATE collections SET title = collection_name")
    op.alter_column('collections', 'title', nullable=False)
    op.drop_constraint('uq_collection_user_parent_name', 'collections', type_='unique')
    op.drop_column('collections', 'collection_name')

    # Auth accounts
    op.drop_index(op.f('ix_auth_accounts_user_id'), table_name='auth_accounts')
    op.drop_table('auth_accounts')