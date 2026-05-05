class AddAliasesToChannelEmail < ActiveRecord::Migration[7.1]
  def change
    add_column :channel_email, :aliases, :string, array: true, default: []
    add_index :channel_email, :aliases, using: 'gin'
  end
end
