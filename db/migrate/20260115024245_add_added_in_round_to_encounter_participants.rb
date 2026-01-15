class AddAddedInRoundToEncounterParticipants < ActiveRecord::Migration[8.0]
  def change
    add_column :encounter_participants, :added_in_round, :integer, null: true
  end
end
