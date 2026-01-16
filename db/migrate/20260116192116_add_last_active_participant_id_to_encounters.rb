class AddLastActiveParticipantIdToEncounters < ActiveRecord::Migration[7.1]
  def change
    add_column :encounters, :last_active_participant_id, :bigint
    add_index :encounters, :last_active_participant_id
  end
end
