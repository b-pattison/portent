class CreateEncounterEffectTargets < ActiveRecord::Migration[7.1]
  def change
    create_table :encounter_effect_targets do |t|
      t.references :encounter_effect, null: false, foreign_key: true
      t.references :encounter_participant, null: false, foreign_key: true

      # trigger_timing:
      #  - start_of_turn
      #  - end_of_turn
      t.integer :trigger_timing, null: false, default: 0

      # Whether the target is still affected (save-pass removes just this target)
      t.boolean :active, null: false, default: true
      t.datetime :ended_at

      # Optional: to prevent double-popups if your UI refreshes
      t.datetime :last_prompted_at

      t.timestamps
    end

    add_index :encounter_effect_targets,
              [:encounter_effect_id, :encounter_participant_id],
              unique: true,
              name: "idx_effect_target_uniqueness"
  end
end
