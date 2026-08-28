"""add_question_bank

Revision ID: f3a4b5c6d7e8
Revises: 1438cd26b844
Create Date: 2026-08-11
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'f3a4b5c6d7e8'
down_revision: Union[str, None] = '1438cd26b844'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'question_bank_items',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('subject_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('subjects.id', ondelete='SET NULL'), nullable=True),
        sa.Column('class_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('classes.id', ondelete='SET NULL'), nullable=True),
        sa.Column('text', sa.Text(), nullable=False),
        sa.Column('rich_text', postgresql.JSONB(), nullable=True),
        sa.Column('question_type', postgresql.ENUM('MCQ', 'SHORT_ANSWER', 'LONG_ANSWER', 'TRUE_FALSE', 'FILL_BLANK', 'MATCH', name='question_type', create_type=False), nullable=False),
        sa.Column('default_marks', sa.Numeric(5, 2), nullable=False, server_default='1.00'),
        sa.Column('negative_marks', sa.Numeric(5, 2), nullable=False, server_default='0.00'),
        sa.Column('options', postgresql.JSONB(), nullable=False, server_default='[]'),
        sa.Column('image_url', sa.Text(), nullable=True),
        sa.Column('explanation', sa.Text(), nullable=True),
        sa.Column('difficulty', postgresql.ENUM('EASY', 'MEDIUM', 'HARD', name='difficulty_level', create_type=False), nullable=True),
        sa.Column('tags', postgresql.JSONB(), nullable=True, server_default='[]'),
        sa.Column('usage_count', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('created_at', postgresql.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text('NOW()')),
        sa.Column('updated_at', postgresql.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text('NOW()')),
    )

    op.create_index('idx_qbank_tenant_subject', 'question_bank_items', ['tenant_id', 'subject_id'])
    op.create_index('idx_qbank_created_by', 'question_bank_items', ['tenant_id', 'created_by'])
    op.create_index('idx_qbank_type_diff', 'question_bank_items', ['tenant_id', 'question_type', 'difficulty'])

    op.add_column(
        'questions',
        sa.Column('bank_item_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('question_bank_items.id', ondelete='SET NULL'), nullable=True)
    )
    op.create_index('idx_questions_bank_item_id', 'questions', ['bank_item_id'])


def downgrade() -> None:
    op.drop_index('idx_questions_bank_item_id', table_name='questions')
    op.drop_column('questions', 'bank_item_id')
    op.drop_index('idx_qbank_type_diff', table_name='question_bank_items')
    op.drop_index('idx_qbank_created_by', table_name='question_bank_items')
    op.drop_index('idx_qbank_tenant_subject', table_name='question_bank_items')
    op.drop_table('question_bank_items')
