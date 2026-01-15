class EncounterEffectTarget < ApplicationRecord
    belongs_to :encounter_effect
    belongs_to :encounter_participant
  
    enum :trigger_timing, {
      no_trigger: 2,
      start_of_turn: 0,
      end_of_turn:   1
    }
  
    scope :active, -> { where(active: true, ended_at: nil) }
  
    def end!
      update!(active: false, ended_at: Time.current)
    end
  end
  
