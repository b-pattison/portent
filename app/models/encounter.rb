class Encounter < ApplicationRecord
  belongs_to :campaign
  has_many :encounter_participants, dependent: :destroy
  has_many :characters, through: :encounter_participants
  has_many :encounter_effects, dependent: :destroy

  STATUSES = %w[setup active ended].freeze
  validates :status, inclusion: { in: STATUSES }

  scope :active, -> { where(status: "active") }
  scope :ended, -> { where(status: "ended") }
  scope :setup, -> { where(status: "setup") }

  belongs_to :active_participant,
  class_name: "EncounterParticipant",
  optional: true
end

