class AddDeathSaveTrackingToEncounterEffectTargets < ActiveRecord::Migration[7.1]
  def change
    add_column :encounter_effect_targets, :death_save_successes, :integer, default: 0, null: false
    add_column :encounter_effect_targets, :death_save_failures, :integer, default: 0, null: false
  end
end
