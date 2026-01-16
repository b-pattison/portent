class EncounterEffect < ApplicationRecord
  belongs_to :encounter
  belongs_to :expires_on_participant, class_name: "EncounterParticipant", optional: true

  has_many :targets, class_name: "EncounterEffectTarget", dependent: :destroy

  enum :duration_type, {
    end_of_round: 0,
    end_of_turn:  1,
    time:         2
  }

  enum :save_ability, {
    wis: 0,
    int: 1,
    str: 2,
    con: 3,
    dex: 4
  }, prefix: true

  validates :name, presence: true
  validates :hp_delta, numericality: { only_integer: true }

  validate :duration_fields_are_consistent

  scope :active, -> { where(ended_at: nil) }

  def ended?
    ended_at.present?
  end

  def end!
    # Use update_columns to skip validations when ending the effect
    # This prevents validation errors when duration_rounds is 0
    update_columns(ended_at: Time.current)
    targets.update_all(active: false, ended_at: Time.current)
  end

  def requires_save?
    save_ability.present?
  end

  private

  def duration_fields_are_consistent
    # Skip validation if effect is already ended
    return if ended_at.present?
    
    case duration_type
    when "end_of_round"
      errors.add(:expires_on_round, "is required") if expires_on_round.blank?
    when "end_of_turn"
      errors.add(:expires_on_participant, "is required") if expires_on_participant_id.blank?
    when "time"
      if duration_rounds.blank? || duration_rounds.to_i <= 0
        errors.add(:duration_rounds, "must be > 0")
      end
    end
  end
end
