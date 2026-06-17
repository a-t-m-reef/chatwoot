class AddLastInboundAtToConversations < ActiveRecord::Migration[7.1]
  disable_ddl_transaction!

  def up
    add_column :conversations, :last_inbound_at, :datetime
    add_index :conversations, :last_inbound_at, algorithm: :concurrently

    backfill_last_inbound_at
  end

  def down
    remove_index :conversations, :last_inbound_at, if_exists: true
    remove_column :conversations, :last_inbound_at
  end

  private

  # Seed the column with the most recent inbound (message_type = 0) timestamp,
  # falling back to created_at when a conversation has no inbound message.
  # Batched by id so the backfill never holds a long lock on large tables.
  def backfill_last_inbound_at
    max_id = select_value('SELECT MAX(id) FROM conversations').to_i
    return if max_id.zero?

    (0..max_id).step(5000) do |start_id|
      execute(<<~SQL.squish)
        UPDATE conversations
        SET last_inbound_at = COALESCE(
          (SELECT MAX(messages.created_at) FROM messages
           WHERE messages.conversation_id = conversations.id
             AND messages.message_type = 0),
          conversations.created_at)
        WHERE id > #{start_id} AND id <= #{start_id + 5000}
      SQL
    end
  end
end
