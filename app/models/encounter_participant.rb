class EncounterParticipant < ApplicationRecord
  belongs_to :encounter
  belongs_to :character

  STATES = %w[alive dead removed].freeze
  validates :state, inclusion: { in: STATES }

  before_validation :snapshot_and_total, on: :create

  private

  def snapshot_and_total
    self.name ||= character.name
    self.initiative_mod ||= character.initiative_mod
    if initiative_roll.present? && initiative_mod.present?
      self.initiative_total ||= initiative_roll + initiative_mod
    end
  end
end
