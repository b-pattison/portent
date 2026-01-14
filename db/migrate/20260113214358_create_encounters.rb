class CreateEncounters < ActiveRecord::Migration[8.0]
  def change
    create_table :encounters do |t|
      t.references :campaign, null: false, foreign_key: true

      t.string  :status, null: false, default: "setup"
      t.integer :round_number, null: false, default: 1

      t.bigint  :active_participant_id
      t.index   :active_participant_id

      t.timestamps
    end
  end
end

