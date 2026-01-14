class AddPcToCharacters < ActiveRecord::Migration[8.0]
  def change
    add_column :characters, :pc, :boolean, null: false, default: true
  end
end

