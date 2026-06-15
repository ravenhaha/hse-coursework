"""strip uploads prefix from avatar_path

Revision ID: e656d6f115b4
Revises: fda6469f87bb
Create Date: 2026-05-29 01:45:25.277081

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e656d6f115b4'
down_revision: Union[str, Sequence[str], None] = 'fda6469f87bb'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE users
        SET avatar_path = SUBSTRING(avatar_path FROM 10)
        WHERE avatar_path LIKE '/uploads/%'
        """
    )


def downgrade() -> None:
    op.execute(
        """
        UPDATE users
        SET avatar_path = '/uploads/' || avatar_path
        WHERE avatar_path IS NOT NULL
          AND avatar_path NOT LIKE '/%'
          AND avatar_path NOT LIKE 'http%'
        """
    )