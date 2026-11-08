import { column, Schema, Table } from '@powersync/web';

const households = new Table({ name: column.text, created_by: column.text, created_at: column.text });
const household_members = new Table({
  household_id: column.text, user_id: column.text, display_name: column.text, joined_at: column.text
}, { indexes: { by_household: ['household_id'], by_user: ['user_id'] } });
const shopping_lists = new Table({
  household_id: column.text, name: column.text, created_by: column.text, created_at: column.text, updated_at: column.text
}, { indexes: { by_household: ['household_id'] } });
const shopping_items = new Table({
  list_id: column.text, name: column.text, quantity: column.text, notes: column.text,
  is_checked: column.integer, checked_by: column.text, checked_at: column.text,
  created_by: column.text, position: column.integer, created_at: column.text, updated_at: column.text
}, { indexes: { by_list: ['list_id'], by_checked: ['list_id', 'is_checked'] } });

export const AppSchema = new Schema({ households, household_members, shopping_lists, shopping_items });
