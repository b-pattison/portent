class CreateEncounterEffects < ActiveRecord::Migration[7.1]
  def change
    create_table :encounter_effects do |t|
      t.references :encounter, null: false, foreign_key: true

      t.string  :name, null: false, default: "Effect"
      t.text    :note

      # Duration / expiry
      # duration_type:
      #  - end_of_round (expires at end of current round)
      #  - end_of_turn  (expires at end of a chosen participant’s turn)
      #  - time         (N rounds derived from seconds/minutes)
      t.integer :duration_type, null: false, default: 0

      # For "time" duration: number of rounds remaining (or initial rounds)
      t.integer :duration_rounds

      # For "end_of_round": which round to expire on (e.g., current round number)
      t.integer :expires_on_round

      # For "end_of_turn": which participant’s turn ends it globally
      t.references :expires_on_participant, foreign_key: { to_table: :encounter_participants }

      # Save rules
      # save_ability: nil means no save
      # 0..4 => WIS/INT/STR/CON/DEX 
      t.integer :save_ability

      # HP effect applied when the effect triggers (per target, per trigger)
      # negative = damage, positive = healing
      t.integer :hp_delta, null: false, default: 0

      t.datetime :ended_at

      t.timestamps
    end

    add_index :encounter_effects, :ended_at
  end
end
