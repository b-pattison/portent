class AddTemporaryToCharacters < ActiveRecord::Migration[8.0]
  def change
    add_column :characters, :temporary, :boolean, default: false, null: false
  end
end
