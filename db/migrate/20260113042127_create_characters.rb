class CreateCharacters < ActiveRecord::Migration[8.0]
  def change
    create_table :characters do |t|
      t.references :campaign, null: false, foreign_key: true
      t.string :name, null: false
      t.integer :initiative_mod, null: false, default: 0

      t.timestamps
    end
  end
end
