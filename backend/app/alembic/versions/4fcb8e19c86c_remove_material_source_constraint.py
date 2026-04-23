"""remove_material_source_constraint

Revision ID: 4fcb8e19c86c
Revises: 5fdecad16de1
Create Date: 2026-04-19 02:01:57.696533

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4fcb8e19c86c'
down_revision: Union[str, Sequence[str], None] = '5fdecad16de1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass